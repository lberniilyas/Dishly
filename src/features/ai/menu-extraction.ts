import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { DISH_TAGS } from "@/features/dashboard/form-utils";
import { AI_MODEL, AiUnavailableError, getAiClient, toAiError } from "./gateway";

/**
 * AI MENU IMPORT — reads photos or a PDF of a paper menu and returns its
 * sections, dishes, descriptions and prices as structured data.
 *
 * Structured outputs guarantee the answer matches `MenuDraftSchema` (no
 * fragile text parsing). The owner always reviews the draft before anything
 * is saved: the AI proposes, the owner decides.
 */

export const MenuDraftSchema = z.object({
  language: z.string().describe('ISO 639-1 code of the language the menu is written in, e.g. "fr".'),
  currency: z.string().nullable().describe('ISO 4217 code of the prices when identifiable (e.g. "EUR", "MAD"), otherwise null.'),
  categories: z.array(
    z.object({
      name: z.string().describe('Section heading as printed, e.g. "Entrées".'),
      dishes: z.array(
        z.object({
          name: z.string().describe("Dish name as printed."),
          description: z.string().nullable().describe("Description or ingredients as printed, or null."),
          price: z.number().nullable().describe('Price as a decimal number in the menu currency (13.5 for "13,50 €"); null if not printed.'),
          tags: z.array(z.enum(DISH_TAGS)).describe("Only labels the menu explicitly shows (symbol or words)."),
        }),
      ),
    }),
  ),
  warnings: z.array(z.string()).describe("Short notes in French about anything unreadable or ambiguous the owner should check."),
});

export type MenuDraft = z.infer<typeof MenuDraftSchema>;

export interface MenuSource {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  data: Uint8Array;
}

const SYSTEM_PROMPT = `You digitize restaurant menus. You receive photos or a PDF of a restaurant's printed menu; the result is imported into the restaurant's digital menu after the owner reviews it.

Copy the text faithfully, in the menu's own language: do not translate, correct, rewrite or embellish names and descriptions. Keep the order of sections and dishes as printed. If several photos show overlapping parts of the same page, list each dish once.

A dish is anything a guest can order: dishes, drinks, set menus ("Menu du jour", "Formule midi") and sides. Leave out decorative text, opening hours, addresses, allergen legends and legal notices. When a dish has several prices (sizes, glass/bottle), use the first one and mention the others at the end of its description.

Use tags only for labels the menu explicitly shows: "maison" for house-made, "vegetarien", "vegan", "epice" for spicy, "signature" for chef's specialities, "partage" for dishes meant to share, "nouveau" for new items. Do not infer tags from ingredients.

If some text is unreadable or a price is ambiguous, still include the dish with what you can read and add a short warning in French so the owner checks it.`;

export async function extractMenu(sources: MenuSource[]): Promise<MenuDraft> {
  const client = getAiClient();
  const content: Anthropic.Beta.BetaContentBlockParam[] = sources.map((source) =>
    source.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: toBase64(source.data) } }
      : { type: "image", source: { type: "base64", media_type: source.mediaType, data: toBase64(source.data) } },
  );
  content.push({
    type: "text",
    text: sources.length > 1 ? `Here are ${sources.length} pages/photos of the same menu. Extract the full menu.` : "Extract the full menu.",
  });

  const params = {
    model: AI_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    // Medium effort: menu reading is careful transcription, not deep reasoning.
    output_config: { effort: "medium" as const, format: betaZodOutputFormat(MenuDraftSchema) },
    messages: [{ role: "user" as const, content }],
  };

  let response;
  try {
    try {
      // If a safety classifier declines the request, the API retries it on a
      // fallback model inside the same call (server-side fallbacks).
      response = await client.beta.messages.parse({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
    } catch (error) {
      // Some gateways don't forward this beta option: retry without it.
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
      response = await client.beta.messages.parse(params);
    }
  } catch (error) {
    throw toAiError(error);
  }

  if (response.stop_reason === "refusal") throw new AiUnavailableError("Le service IA n'a pas pu traiter ce document. Essayez avec d'autres photos.");
  if (response.stop_reason === "max_tokens") throw new AiUnavailableError("Ce menu est trop long pour un seul import. Importez-le en plusieurs fois (quelques pages à chaque fois).");
  if (!response.parsed_output) throw new AiUnavailableError("La lecture du menu a échoué. Réessayez avec des photos plus nettes.");
  return response.parsed_output;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
}

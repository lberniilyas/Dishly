import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude, reached through the Vercel AI Gateway.
 *
 * We use the official Anthropic SDK; the gateway speaks the same API, so we
 * only point the SDK at it (one key and one bill for every AI feature,
 * usage dashboards in Vercel). Swap AI_GATEWAY_BASE_URL/AI_GATEWAY_API_KEY
 * for an Anthropic key to call Anthropic directly — no code change.
 */

/** Gateway model id. Claude Opus 5.5: best at reading dense, multi-column menus. */
export const AI_MODEL = process.env.AI_MENU_MODEL ?? "anthropic/claude-opus-5.5";

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

let client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (!isAiConfigured()) throw new AiUnavailableError("L'import IA n'est pas configuré (variable AI_GATEWAY_API_KEY manquante).");
  client ??= new Anthropic({
    baseURL: process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh",
    authToken: process.env.AI_GATEWAY_API_KEY,
    apiKey: null,
    timeout: 150_000,
    maxRetries: 2,
  });
  return client;
}

/** Errors the owner can understand (French), as opposed to bugs. */
export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Translates API failures into owner-facing messages. */
export function toAiError(error: unknown): AiUnavailableError {
  if (error instanceof AiUnavailableError) return error;
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AiUnavailableError("Le service IA n'est pas encore activé sur ce compte (AI Gateway : moyen de paiement requis).");
  }
  if (error instanceof Anthropic.AuthenticationError) return new AiUnavailableError("Clé du service IA invalide. Vérifiez AI_GATEWAY_API_KEY.");
  if (error instanceof Anthropic.RateLimitError) return new AiUnavailableError("Le service IA est très sollicité. Réessayez dans une minute.");
  if (error instanceof Anthropic.APIConnectionError) return new AiUnavailableError("Impossible de joindre le service IA. Vérifiez la connexion et réessayez.");
  if (error instanceof Anthropic.APIError) return new AiUnavailableError(`Le service IA a renvoyé une erreur (${error.status ?? "?"}). Réessayez.`);
  return new AiUnavailableError("La lecture du menu a échoué. Réessayez avec des photos plus nettes.");
}

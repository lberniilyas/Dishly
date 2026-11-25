/**
 * Checks the AI menu import end to end with a real request:
 *
 *   npm run ai:check [path/to/menu.jpg|.pdf]
 *
 * Sends seed/samples/menu-sample.jpg (or your file) to the AI menu reader
 * and prints what it found. Use it after setting AI_GATEWAY_API_KEY.
 * Costs a few cents per run.
 */
import { readFile } from "node:fs/promises";
import { AiUnavailableError } from "../src/features/ai/gateway";
import { extractMenu, type MenuSource } from "../src/features/ai/menu-extraction";

async function main() {
  const file = process.argv[2] ?? "seed/samples/menu-sample.jpg";
  const mediaType: MenuSource["mediaType"] = file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : "image/jpeg";
  const data = new Uint8Array(await readFile(file));
  console.log(`Reading ${file} (${Math.round(data.byteLength / 1024)} KB) with ${process.env.AI_MENU_MODEL ?? "anthropic/claude-opus-5.5"}…`);

  const started = Date.now();
  const draft = await extractMenu([{ mediaType, data }]);
  console.log(`\nLanguage: ${draft.language} · currency: ${draft.currency ?? "?"} · ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
  for (const category of draft.categories) {
    console.log(`■ ${category.name}`);
    for (const dish of category.dishes) {
      const price = dish.price == null ? "—" : dish.price.toFixed(2);
      console.log(`   ${dish.name.padEnd(42)} ${price.padStart(7)}${dish.tags.length ? `  [${dish.tags.join(", ")}]` : ""}`);
      if (dish.description) console.log(`      ${dish.description}`);
    }
  }
  if (draft.warnings.length) console.log(`\nWarnings:\n - ${draft.warnings.join("\n - ")}`);
  console.log("\n✓ AI menu import works.");
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof AiUnavailableError ? error.message : error instanceof Error ? error.message : error}`);
  process.exit(1);
});

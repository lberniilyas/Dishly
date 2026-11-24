/**
 * Runs the model pipeline on a local file — handy to test a scan before
 * uploading it, or to debug the pipeline.
 *
 *   npm run model:process -- path/to/scan.glb [--size-cm 26] [--out out-dir]
 *
 * Writes model.glb, model.usdz and report.json into the output folder.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { processModel } from "../src/features/model-pipeline";

async function main() {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith("--"));
  if (!input) {
    console.error("Usage: npm run model:process -- <file.glb> [--size-cm 26] [--out dir]");
    process.exit(1);
  }
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const sizeCm = flag("--size-cm") ? Number(flag("--size-cm")) : null;
  const outDir = path.resolve(flag("--out") ?? path.join("out", path.basename(input, path.extname(input))));

  console.log(`Processing ${input}${sizeCm ? ` → ${sizeCm} cm` : ""}`);
  const { glb, usdz, report } = await processModel(new Uint8Array(await readFile(input)), {
    targetSizeCm: sizeCm,
    log: console.log,
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "model.glb"), glb);
  if (usdz) await writeFile(path.join(outDir, "model.usdz"), usdz);
  await writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log(`
Preset:      ${report.preset}
Input:       ${mb(report.inputBytes)}, ${report.before.triangles} triangles
GLB:         ${mb(report.glbBytes)}, ${report.after.triangles} triangles
USDZ:        ${report.usdzBytes ? mb(report.usdzBytes) : "—"}
Real size:   ${report.finalSizeCm.x} × ${report.finalSizeCm.z} cm, ${report.finalSizeCm.y} cm high
Warnings:    ${report.warnings.length ? "\n  - " + report.warnings.join("\n  - ") : "none"}
Output:      ${outDir}
Took:        ${report.durationMs} ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

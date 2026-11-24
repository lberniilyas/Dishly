import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import type { Document } from "@gltf-transform/core";
import { getIO } from "./io";
import { cleanupModel } from "./steps/cleanup";
import { inspectModel } from "./steps/inspect";
import { normalizeModel } from "./steps/normalize";
import { simplifyModel } from "./steps/simplify";
import { compressTextures, type TexturePreset } from "./steps/textures";
import { writeUsdz } from "./usdz/write-usdz";
import {
  PipelineError,
  type ModelStats,
  type PipelineOptions,
  type PipelineReport,
  type PipelineResult,
  type StepTiming,
} from "./types";

export * from "./types";

/**
 * MODEL PIPELINE — turns a raw .glb (from a phone scanning app today, from a
 * "video → 3D" service later) into two files ready for diners:
 *
 *   raw .glb ─► cleanup ─► simplify ─► textures ─► normalize (real size)
 *                                                     ├─► model.usdz  (iPhone AR Quick Look)
 *                                                     └─► model.glb   (Draco-compressed: web viewer + Android AR)
 *
 * A future "video → 3D" step only needs to produce the raw .glb that enters
 * on the left; nothing after it changes.
 *
 * If the result is too heavy, we start again from the raw file with a lighter
 * preset (fewer triangles, smaller textures) rather than compressing twice.
 */

interface QualityPreset extends TexturePreset {
  name: string;
  maxTriangles: number;
}

const PRESETS: QualityPreset[] = [
  { name: "high", maxTriangles: 80_000, baseColorMax: 2048, otherMax: 1024, jpegQuality: 85 },
  { name: "medium", maxTriangles: 50_000, baseColorMax: 1536, otherMax: 1024, jpegQuality: 80 },
  { name: "light", maxTriangles: 30_000, baseColorMax: 1024, otherMax: 512, jpegQuality: 78 },
];

const MB = 1024 * 1024;
export const DEFAULT_MAX_GLB_BYTES = 5 * MB;
export const DEFAULT_MAX_USDZ_BYTES = 8 * MB;

export async function processModel(input: Uint8Array, options: PipelineOptions = {}): Promise<PipelineResult> {
  const started = Date.now();
  const log = options.log ?? (() => {});
  const maxGlb = options.maxGlbBytes ?? DEFAULT_MAX_GLB_BYTES;
  const maxUsdz = options.maxUsdzBytes ?? DEFAULT_MAX_USDZ_BYTES;
  const io = await getIO();

  let before: ModelStats | null = null;
  let result: PipelineResult | null = null;

  for (const preset of PRESETS) {
    const warnings: string[] = [];
    const steps: StepTiming[] = [];
    const time = async <T,>(name: string, fn: () => Promise<T> | T, note?: (r: T) => string): Promise<T> => {
      const t0 = Date.now();
      const r = await fn();
      steps.push({ name, ms: Date.now() - t0, note: note?.(r) });
      log(`  [${preset.name}] ${name}${note ? ` — ${note(r)}` : ""} (${Date.now() - t0} ms)`);
      return r;
    };

    const doc: Document = await time("read", () => readGlb(io, input));
    before ??= inspectModel(doc);

    await time("cleanup", () => cleanupModel(doc, warnings));
    await time("simplify", () => simplifyModel(doc, preset.maxTriangles), (r) => `${r.before} → ${r.after} triangles`);
    await time("textures", () => compressTextures(doc, preset, warnings));
    const { detectedSizeCm, scaleFactor } = await time(
      "normalize",
      () => normalizeModel(doc, options.targetSizeCm, warnings),
      (r) => `detected ${r.detectedSizeCm.x}×${r.detectedSizeCm.z} cm, scale ×${r.scaleFactor.toFixed(3)}`,
    );
    const after = inspectModel(doc);

    // USDZ is written from the uncompressed document (USD has no Draco).
    const usdz = options.skipUsdz ? null : await time("usdz", () => writeUsdz(doc, warnings), (b) => `${(b.byteLength / MB).toFixed(2)} MB`);

    // Draco compression is applied when the .glb is written.
    doc
      .createExtension(KHRDracoMeshCompression)
      .setRequired(true)
      .setEncoderOptions({
        method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
        encodeSpeed: 5,
        decodeSpeed: 5,
        // Quantization bits: 14 bits on a 30 cm dish ≈ 0.02 mm steps — invisible.
        quantizationBits: { POSITION: 14, NORMAL: 10, TEX_COORD: 12, COLOR: 8, GENERIC: 12 },
      });
    const glb = await time("write glb", () => io.writeBinary(doc), (b) => `${(b.byteLength / MB).toFixed(2)} MB`);

    const report: PipelineReport = {
      preset: preset.name,
      inputBytes: input.byteLength,
      glbBytes: glb.byteLength,
      usdzBytes: usdz?.byteLength ?? null,
      before,
      after,
      detectedSizeCm,
      finalSizeCm: after.sizeCm,
      scaleFactor,
      warnings,
      steps,
      durationMs: Date.now() - started,
    };
    result = { glb, usdz, report };

    const fits = glb.byteLength <= maxGlb && (!usdz || usdz.byteLength <= maxUsdz);
    if (fits) break;
    log(`  [${preset.name}] too heavy, retrying with a lighter preset…`);
  }

  const final = result!;
  if (final.glb.byteLength > maxGlb) {
    final.report.warnings.push(
      `Le modèle pèse encore ${(final.glb.byteLength / MB).toFixed(1)} Mo (objectif : ${(maxGlb / MB).toFixed(0)} Mo). Il risque de charger lentement en 4G.`,
    );
  }
  if (final.usdz && final.usdz.byteLength > maxUsdz) {
    final.report.warnings.push(
      `Le fichier AR iPhone pèse ${(final.usdz.byteLength / MB).toFixed(1)} Mo : l'ouverture en AR peut prendre quelques secondes.`,
    );
  }
  final.report.durationMs = Date.now() - started;
  return final;
}

async function readGlb(io: Awaited<ReturnType<typeof getIO>>, input: Uint8Array): Promise<Document> {
  try {
    return await io.readBinary(input);
  } catch (error) {
    throw new PipelineError(
      `Fichier .glb illisible. Exportez à nouveau le modèle depuis votre application de scan (format GLB). Détail : ${(error as Error).message}`,
    );
  }
}

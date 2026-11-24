/**
 * Shared types for the 3D model pipeline.
 *
 * The pipeline is plain Node.js code (no Next.js imports) so it can run in a
 * Next.js route handler, in a CLI script, or later in a background worker.
 */

/** Size of the model's bounding box, in centimetres (x = width, y = height, z = depth). */
export interface SizeCm {
  x: number;
  y: number;
  z: number;
}

export interface TextureStats {
  name: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  bytes: number;
  slots: string[];
}

export interface ModelStats {
  triangles: number;
  vertices: number;
  meshes: number;
  materials: number;
  textures: TextureStats[];
  sizeCm: SizeCm;
}

export interface PipelineOptions {
  /**
   * Real-world size wanted in AR, in cm: the largest horizontal dimension
   * (plate diameter, cake width…). `null`/`undefined` keeps the size found in
   * the file (scanning apps usually export in metres already).
   */
  targetSizeCm?: number | null;
  /** Soft cap for the optimized .glb. Above it we retry with lighter settings, then warn. */
  maxGlbBytes?: number;
  /** Soft cap for the generated .usdz (iPhone AR file). */
  maxUsdzBytes?: number;
  /** Skip USDZ generation (e.g. the owner uploaded their own .usdz). */
  skipUsdz?: boolean;
  /** Optional logger for progress messages. */
  log?: (message: string) => void;
}

export interface StepTiming {
  name: string;
  ms: number;
  note?: string;
}

export interface PipelineReport {
  /** Which quality preset produced the final files ("high", "medium", "light"). */
  preset: string;
  inputBytes: number;
  glbBytes: number;
  usdzBytes: number | null;
  before: ModelStats;
  after: ModelStats;
  /** Size found in the uploaded file, before rescaling. */
  detectedSizeCm: SizeCm;
  /** Size of the published model (what the diner sees in AR). */
  finalSizeCm: SizeCm;
  scaleFactor: number;
  warnings: string[];
  steps: StepTiming[];
  durationMs: number;
}

export interface PipelineResult {
  glb: Uint8Array;
  usdz: Uint8Array | null;
  report: PipelineReport;
}

/** Thrown for problems the owner can fix (bad file, empty model…). Message is user-facing (French). */
export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

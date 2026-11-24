import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Dish photos are resized ONCE, when uploaded, into fixed variants:
 *
 *   sm   480 px wide   → menu card thumbnails (~110 css px × 3x retina screens)
 *   lg  1200 px wide   → dish page / 3D loading poster
 *   blur   24 px wide  → tiny inline placeholder shown instantly while the
 *                         real photo downloads (no empty grey boxes)
 *
 * Doing it at upload means diners download small WebP files straight from the
 * CDN, with no per-view image-processing cost or delay.
 */
export interface ProcessedPhoto {
  hash: string;
  sm: Uint8Array;
  lg: Uint8Array;
  blurDataUrl: string;
  width: number;
  height: number;
}

export async function processPhoto(input: Uint8Array): Promise<ProcessedPhoto> {
  // rotate() applies the EXIF orientation of phone photos.
  const base = sharp(input, { failOn: "none" }).rotate();
  const lgBuffer = await base.clone().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  const sm = await base.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
  const blur = await base.clone().resize({ width: 24 }).webp({ quality: 40 }).toBuffer();

  return {
    hash: createHash("sha256").update(input).digest("hex").slice(0, 12),
    sm: new Uint8Array(sm),
    lg: new Uint8Array(lgBuffer.data),
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    width: lgBuffer.info.width,
    height: lgBuffer.info.height,
  };
}

/** Short content hash used in file names (cache-busting + immutable caching). */
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

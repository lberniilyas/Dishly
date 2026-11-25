import "server-only";
import { createHash } from "node:crypto";
import sharp from "sharp";

/** Restaurant logo: max 512 px, WebP, keeps transparency. */
export async function processLogo(input: Uint8Array): Promise<{ hash: string; data: Uint8Array }> {
  const data = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
  return { hash: createHash("sha256").update(input).digest("hex").slice(0, 12), data: new Uint8Array(data) };
}

/** Rejects anything that isn't really an image before we spend time on it. */
export async function isImage(input: Uint8Array): Promise<boolean> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    return Boolean(meta.width && meta.height && meta.width <= 12000 && meta.height <= 12000);
  } catch {
    return false;
  }
}

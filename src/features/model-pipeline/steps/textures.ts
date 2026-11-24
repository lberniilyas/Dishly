import type { Document, Texture } from "@gltf-transform/core";
import { listTextureSlots } from "@gltf-transform/functions";
import sharp from "sharp";

export interface TexturePreset {
  /** Max width/height of colour textures (what the diner actually looks at). */
  baseColorMax: number;
  /** Max width/height of normal / roughness / occlusion maps (less visible). */
  otherMax: number;
  jpegQuality: number;
}

/**
 * Resizes and re-encodes every texture as JPEG (or PNG when transparency is
 * really used).
 *
 * Why JPEG/PNG and not WebP/KTX2? The same .glb is opened by three different
 * renderers: model-viewer in the browser, Google Scene Viewer on Android, and
 * our USDZ export for iPhone AR Quick Look. JPEG/PNG is the only combination
 * all three accept. KTX2 would also need a native binary that Vercel lacks.
 */
export async function compressTextures(doc: Document, preset: TexturePreset, warnings: string[]): Promise<void> {
  const root = doc.getRoot();
  const transparentBaseColors = texturesUsedAsTransparentBaseColor(doc);

  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const mime = texture.getMimeType();
    if (mime === "image/ktx2") {
      warnings.push("Texture KTX2 conservée telle quelle : elle risque de ne pas s'afficher sur iPhone.");
      continue;
    }

    const slots = listTextureSlots(texture);
    const isBaseColor = slots.includes("baseColorTexture");
    const isNormal = slots.includes("normalTexture");
    const max = isBaseColor || slots.includes("emissiveTexture") ? preset.baseColorMax : preset.otherMax;

    // `failOn: 'none'` tolerates slightly broken images that scanning apps sometimes produce.
    const input = sharp(image, { failOn: "none" });
    const keepAlpha = transparentBaseColors.has(texture) && !(await input.clone().stats()).isOpaque;
    const resized = input.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true });

    const output = keepAlpha
      ? await resized.png({ compressionLevel: 9 }).toBuffer()
      : await resized
          .flatten({ background: "#ffffff" })
          .jpeg({
            quality: isNormal ? Math.min(95, preset.jpegQuality + 7) : preset.jpegQuality,
            mozjpeg: true,
            // Normal maps encode directions in colours: full chroma avoids artefacts.
            chromaSubsampling: isNormal ? "4:4:4" : "4:2:0",
          })
          .toBuffer();

    const ext = keepAlpha ? "png" : "jpg";
    texture
      .setImage(new Uint8Array(output))
      .setMimeType(keepAlpha ? "image/png" : "image/jpeg")
      .setURI(`${slug(texture.getName()) || "texture"}.${ext}`);
  }
}

function texturesUsedAsTransparentBaseColor(doc: Document): Set<Texture> {
  const set = new Set<Texture>();
  for (const material of doc.getRoot().listMaterials()) {
    const tex = material.getBaseColorTexture();
    if (tex && material.getAlphaMode() !== "OPAQUE") set.add(tex);
  }
  return set;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

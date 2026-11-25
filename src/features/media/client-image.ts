/**
 * Browser-side image shrinking, used before uploads.
 *
 * Phone photos weigh 3–10 MB; we redraw them at a sensible size first so the
 * upload is quick on 4G and fits the 4.5 MB request limit of serverless
 * hosting. The server then makes the final variants. iPhone HEIC photos are
 * converted by Safari when picked, and decoded here when the browser can.
 */
export async function downscaleImage(file: File, maxSize = 2048, quality = 0.88): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    // Already small and light: keep the original bytes.
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type !== "image/heic") {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // Keep PNG for images with transparency (logos), JPEG otherwise.
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) return file;
    const name = file.name.replace(/\.\w+$/, type === "image/png" ? ".png" : ".jpg");
    return new File([blob], name, { type });
  } catch {
    return file; // the server validates and resizes anyway
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

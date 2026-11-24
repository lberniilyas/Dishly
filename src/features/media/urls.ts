import { getSupabaseUrl } from "@/lib/supabase/env";

/** Public bucket holding photos, logos and optimized 3D models. */
export const MEDIA_BUCKET = "media";
/** Private bucket for raw uploads (phase 2). */
export const UPLOADS_BUCKET = "model-uploads";

/**
 * URL of a file in the public "media" bucket. Files are served by Supabase's
 * CDN; their names contain a content hash, so they can be cached forever.
 */
export function publicMediaUrl(path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${getSupabaseUrl()}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
}

/** Storage layout — every path starts with the restaurant id (used by storage RLS). */
export const mediaPaths = {
  dishPhoto: (restaurantId: string, dishId: string, hash: string, variant: "sm" | "lg") =>
    `${restaurantId}/dishes/${dishId}/photo-${hash}-${variant}.webp`,
  modelFile: (restaurantId: string, dishId: string, modelId: string, hash: string, ext: "glb" | "usdz") =>
    `${restaurantId}/dishes/${dishId}/models/${modelId}/${hash}.${ext}`,
};

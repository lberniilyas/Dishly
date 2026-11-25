import { NextResponse } from "next/server";
import { z } from "zod";
import { contentHash } from "@/features/media/photos";
import { MEDIA_BUCKET, UPLOADS_BUCKET, mediaPaths } from "@/features/media/urls";
import { PipelineError, processModel } from "@/features/model-pipeline";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/models/process — turns an uploaded raw scan into a publishable
 * 3D model (optimized .glb + iPhone .usdz at real size).
 *
 * The browser has already uploaded the raw file straight to the private
 * "model-uploads" bucket (too big to go through this function). Here we:
 *   1. check the signed-in owner can access the dish (Row Level Security),
 *   2. run the model pipeline (same code as the seed script),
 *   3. store the results and a new `dish_models` version (not yet public:
 *      the owner reviews it, adjusts the size, then publishes).
 *
 * A route handler (not a Server Action) so it can run up to 5 minutes.
 */
export const maxDuration = 300;

const YEAR = "31536000";
const MAX_RAW_BYTES = 60 * 1024 * 1024;

const BodySchema = z.object({
  dishId: z.uuid(),
  rawPath: z.string().min(1).max(300),
  usdzRawPath: z.string().max(300).nullish(),
  targetSizeCm: z.number().min(1).max(200).nullish(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const sizeIssue = parsed.error.issues.some((issue) => issue.path[0] === "targetSizeCm");
    return NextResponse.json({ error: sizeIssue ? "La taille doit être comprise entre 1 et 200 cm." : "Requête invalide." }, { status: 400 });
  }
  const { dishId, rawPath, usdzRawPath, targetSizeCm } = parsed.data;

  // Dishes of a published menu are readable by anyone (diners), so check
  // explicitly that the signed-in user manages this dish's restaurant.
  const { data: dish } = await supabase.from("dishes").select("id, restaurant_id").eq("id", dishId).maybeSingle();
  const { data: membership } = dish
    ? await supabase.from("restaurant_members").select("role").eq("restaurant_id", dish.restaurant_id).eq("user_id", auth.claims.sub).maybeSingle()
    : { data: null };
  if (!dish || !membership) return NextResponse.json({ error: "Plat introuvable." }, { status: 404 });
  const folder = `${dish.restaurant_id}/`;
  if (!rawPath.startsWith(folder) || (usdzRawPath && !usdzRawPath.startsWith(folder))) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  const { data: version, error: insertError } = await supabase
    .from("dish_models")
    .insert({ dish_id: dishId, restaurant_id: dish.restaurant_id, source: "upload", status: "processing", raw_path: rawPath, target_size_cm: targetSizeCm ?? null })
    .select("id")
    .single();
  if (insertError || !version) return NextResponse.json({ error: "Impossible de créer la version." }, { status: 500 });
  const modelId = version.id as string;

  try {
    const raw = await download(supabase, rawPath);
    if (raw.byteLength > MAX_RAW_BYTES) throw new PipelineError("Fichier trop lourd (60 Mo maximum). Exportez le scan en qualité moyenne.");

    // An owner-supplied .usdz is used as-is, but only at its original size:
    // we can't rescale a USDZ, so resizing switches back to a generated one.
    const ownerUsdz = usdzRawPath && targetSizeCm == null ? await download(supabase, usdzRawPath) : null;
    if (ownerUsdz && !(ownerUsdz[0] === 0x50 && ownerUsdz[1] === 0x4b)) throw new PipelineError("Le fichier .usdz fourni n'est pas valide.");

    const { glb, usdz, report } = await processModel(raw, { targetSizeCm: targetSizeCm ?? null, skipUsdz: Boolean(ownerUsdz) });
    if (usdzRawPath && targetSizeCm != null) {
      report.warnings.push("Votre fichier .usdz ne peut pas être redimensionné : la version iPhone a été générée automatiquement à la nouvelle taille.");
    }

    const glbPath = mediaPaths.modelFile(dish.restaurant_id, dishId, modelId, contentHash(glb), "glb");
    await upload(supabase, glbPath, glb, "model/gltf-binary");
    const usdzBytes = ownerUsdz ?? usdz;
    let usdzPath: string | null = null;
    if (usdzBytes) {
      usdzPath = mediaPaths.modelFile(dish.restaurant_id, dishId, modelId, contentHash(usdzBytes), "usdz");
      await upload(supabase, usdzPath, usdzBytes, "model/vnd.usdz+zip");
    }

    await supabase
      .from("dish_models")
      .update({
        status: "ready",
        glb_path: glbPath,
        usdz_path: usdzPath,
        usdz_origin: ownerUsdz ? "owner" : usdz ? "generated" : null,
        size_cm: report.finalSizeCm,
        original_bytes: report.inputBytes,
        glb_bytes: report.glbBytes,
        usdz_bytes: usdzBytes?.byteLength ?? null,
        triangle_count: report.after.triangles,
        report,
        warnings: report.warnings,
      })
      .eq("id", modelId);

    return NextResponse.json({ modelId, status: "ready", sizeCm: report.finalSizeCm, warnings: report.warnings });
  } catch (error) {
    const message =
      error instanceof PipelineError ? error.message : "Le traitement a échoué. Vérifiez que le fichier est un .glb exporté par votre application de scan.";
    if (!(error instanceof PipelineError)) console.error("[models/process]", error);
    await supabase.from("dish_models").update({ status: "failed", error: message }).eq("id", modelId);
    return NextResponse.json({ modelId, status: "failed", error: message }, { status: 422 });
  }
}

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function download(supabase: Supabase, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(UPLOADS_BUCKET).download(path);
  if (error || !data) throw new PipelineError("Fichier envoyé introuvable. Recommencez l'envoi.");
  return new Uint8Array(await data.arrayBuffer());
}

async function upload(supabase: Supabase, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, cacheControl: YEAR, upsert: true });
  if (error) throw new Error(`Upload failed (${path}): ${error.message}`);
}

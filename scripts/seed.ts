/**
 * Loads the demo restaurant into Supabase: rows, photos and 3D models.
 *
 *   npm run samples:fetch   # once: downloads the raw 3D scans
 *   npm run seed            # (re)creates the demo restaurant
 *
 * Each 3D model goes through the SAME pipeline as an owner upload will in
 * phase 2 (optimize → real size → .glb + .usdz), then is uploaded to the
 * public "media" bucket. Uses the secret key, so it runs on your machine only.
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { processModel } from "../src/features/model-pipeline";
import { contentHash, processPhoto } from "../src/features/media/photos";
import { MEDIA_BUCKET, mediaPaths } from "../src/features/media/urls";
import { getSupabaseSecretKey, getSupabaseUrl } from "../src/lib/supabase/env";
import { DEMO_CATEGORIES, DEMO_RESTAURANT } from "../seed/demo-restaurant";

const ROOT = process.cwd();
const YEAR_IN_SECONDS = "31536000"; // file names contain a content hash → cache forever

const supabase = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const r = DEMO_RESTAURANT;
  console.log(`Seeding "${r.name}" into ${getSupabaseUrl()}`);
  await checkSourcesExist();

  // 1. Remove the previous demo (children first, in case cascades are missing).
  const dishIds = DEMO_CATEGORIES.flatMap((c) => c.dishes.map((d) => d.id));
  await must(supabase.from("dishes").update({ active_model_id: null }).eq("restaurant_id", r.id), "reset models");
  await must(supabase.from("events").delete().eq("restaurant_id", r.id), "delete events");
  await must(supabase.from("dish_models").delete().eq("restaurant_id", r.id), "delete models");
  await must(supabase.from("dishes").delete().eq("restaurant_id", r.id), "delete dishes");
  await must(supabase.from("categories").delete().eq("restaurant_id", r.id), "delete categories");
  await must(supabase.from("restaurants").delete().eq("id", r.id), "delete restaurant");

  // 2. Restaurant, categories, dishes.
  await must(
    supabase.from("restaurants").insert({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: { [r.locale]: r.tagline },
      brand_color: r.brandColor,
      currency: r.currency,
      default_locale: r.locale,
      enabled_locales: [r.locale],
      is_published: true,
    }),
    "insert restaurant",
  );
  await must(
    supabase.from("categories").insert(DEMO_CATEGORIES.map((c, i) => ({ id: c.id, restaurant_id: r.id, name: { [r.locale]: c.name }, position: i }))),
    "insert categories",
  );
  await must(
    supabase.from("dishes").insert(
      DEMO_CATEGORIES.flatMap((c) =>
        c.dishes.map((d, i) => ({
          id: d.id,
          restaurant_id: r.id,
          category_id: c.id,
          name: { [r.locale]: d.name },
          description: d.description ? { [r.locale]: d.description } : {},
          price_cents: d.priceCents,
          tags: d.tags ?? [],
          position: i,
        })),
      ),
    ),
    "insert dishes",
  );
  console.log(`✓ ${DEMO_CATEGORIES.length} categories, ${dishIds.length} dishes`);

  // 3. Photos and 3D models.
  for (const dish of DEMO_CATEGORIES.flatMap((c) => c.dishes)) {
    if (dish.photo) {
      const photo = await processPhoto(new Uint8Array(await readFile(path.join(ROOT, "seed", "photos", dish.photo))));
      const sm = mediaPaths.dishPhoto(r.id, dish.id, photo.hash, "sm");
      const lg = mediaPaths.dishPhoto(r.id, dish.id, photo.hash, "lg");
      await upload(sm, photo.sm, "image/webp");
      await upload(lg, photo.lg, "image/webp");
      await must(
        supabase
          .from("dishes")
          .update({ photo: { sm, lg, blur: photo.blurDataUrl, width: photo.width, height: photo.height } })
          .eq("id", dish.id),
        "save photo",
      );
      console.log(`✓ photo  ${dish.name} (${kb(photo.sm.byteLength)} / ${kb(photo.lg.byteLength)})`);
    }

    if (dish.model) {
      const raw = new Uint8Array(await readFile(path.join(ROOT, "seed", "sources", dish.model.source)));
      const { glb, usdz, report } = await processModel(raw, { targetSizeCm: dish.model.targetSizeCm });
      const modelId = crypto.randomUUID();
      const glbPath = mediaPaths.modelFile(r.id, dish.id, modelId, contentHash(glb), "glb");
      await upload(glbPath, glb, "model/gltf-binary");
      let usdzPath: string | null = null;
      if (usdz) {
        usdzPath = mediaPaths.modelFile(r.id, dish.id, modelId, contentHash(usdz), "usdz");
        await upload(usdzPath, usdz, "model/vnd.usdz+zip");
      }
      await must(
        supabase.from("dish_models").insert({
          id: modelId,
          dish_id: dish.id,
          restaurant_id: r.id,
          source: "seed",
          status: "ready",
          glb_path: glbPath,
          usdz_path: usdzPath,
          usdz_origin: usdz ? "generated" : null,
          target_size_cm: dish.model.targetSizeCm,
          size_cm: report.finalSizeCm,
          original_bytes: report.inputBytes,
          glb_bytes: report.glbBytes,
          usdz_bytes: report.usdzBytes,
          triangle_count: report.after.triangles,
          report,
          warnings: report.warnings,
        }),
        "insert model",
      );
      await must(supabase.from("dishes").update({ active_model_id: modelId }).eq("id", dish.id), "activate model");
      console.log(
        `✓ model  ${dish.name}: ${mb(report.inputBytes)} → glb ${mb(report.glbBytes)} + usdz ${report.usdzBytes ? mb(report.usdzBytes) : "—"}, ` +
          `${Math.max(report.finalSizeCm.x, report.finalSizeCm.z)} cm`,
      );
    }
  }

  console.log(`\nDone. Open http://localhost:3000/r/${r.slug}`);
}

async function upload(objectPath: string, bytes: Uint8Array, contentType: string) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(objectPath, bytes, {
    contentType,
    cacheControl: YEAR_IN_SECONDS,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed for ${objectPath}: ${error.message}`);
}

async function must<T extends { error: { message: string } | null }>(query: PromiseLike<T>, label: string): Promise<T> {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

async function checkSourcesExist() {
  for (const dish of DEMO_CATEGORIES.flatMap((c) => c.dishes)) {
    if (!dish.model) continue;
    try {
      await access(path.join(ROOT, "seed", "sources", dish.model.source));
    } catch {
      throw new Error(`Missing seed/sources/${dish.model.source}. Run "npm run samples:fetch" first.`);
    }
  }
}

const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✗ ${message}`);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/.test(message)) {
    console.error("  → Supabase is unreachable. Check NEXT_PUBLIC_SUPABASE_URL in .env.local and your internet connection.");
  } else if (/relation .* does not exist|schema cache/i.test(message)) {
    console.error("  → The database tables are missing. Run the migration first (README › Setup, step 3).");
  } else if (/Invalid API key|JWT|apikey/i.test(message)) {
    console.error("  → Check SUPABASE_SECRET_KEY in .env.local (it must be the secret / service_role key).");
  }
  process.exit(1);
});

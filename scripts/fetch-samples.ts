/**
 * Downloads the sample food scans used by the demo restaurant and builds the
 * raw .glb files the seed script feeds into the model pipeline.
 *
 *   npm run samples:fetch
 *
 * Source: Poly Haven (https://polyhaven.com) — all assets are CC0 (public
 * domain): free for commercial use, no attribution required (we credit them
 * in the README anyway). They are real photogrammetry scans at real size.
 *
 * Output (git-ignored): seed/sources/*.glb
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Document, Scene } from "@gltf-transform/core";
import { mergeDocuments, unpartition } from "@gltf-transform/functions";
import { getIO } from "../src/features/model-pipeline/io";
import { forEachMeshNode, mainScene, sceneBounds, transformPoint } from "../src/features/model-pipeline/geometry";

const SOURCES_DIR = path.resolve(process.cwd(), "seed", "sources");
const DOWNLOAD_DIR = path.join(SOURCES_DIR, "polyhaven");
const ASSETS = ["croissant", "carved_wooden_plate", "carrot_cake", "strawberry_chocolate_cake"] as const;
const USER_AGENT = "dishly-sample-fetcher/1.0";

interface PolyHavenFile {
  url: string;
  md5: string;
  include?: Record<string, { url: string; md5: string }>;
}

async function main() {
  const io = await getIO();
  const gltfPaths: Record<string, string> = {};

  for (const id of ASSETS) {
    gltfPaths[id] = await downloadAsset(id);
  }

  console.log("\nBuilding .glb sources…");
  await writeGlb(io, await io.read(gltfPaths.carrot_cake), "carrot-cake.glb");
  await writeGlb(io, await io.read(gltfPaths.strawberry_chocolate_cake), "strawberry-chocolate-cake.glb");

  // The croissant is served on the 27 cm carved wooden plate: a convincing
  // "real size on your table" demo.
  const plate = await io.read(gltfPaths.carved_wooden_plate);
  const croissant = await io.read(gltfPaths.croissant);
  placeOnPlate(plate, croissant, 25);
  await writeGlb(io, plate, "croissant-on-plate.glb");

  console.log("\nDone. Next: npm run seed");
}

async function downloadAsset(id: string): Promise<string> {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Poly Haven API error for ${id}: ${res.status}`);
  const files = (await res.json()) as { gltf: Record<string, { gltf: PolyHavenFile }> };
  const entry = files.gltf["2k"].gltf;
  const dir = path.join(DOWNLOAD_DIR, id);
  const mainName = path.basename(new URL(entry.url).pathname);

  const all: [string, { url: string; md5: string }][] = [[mainName, entry], ...Object.entries(entry.include ?? {})];
  for (const [relative, file] of all) {
    const target = path.resolve(dir, relative);
    // Never write outside the asset folder, whatever the API returns.
    if (!target.startsWith(dir + path.sep)) throw new Error(`Unexpected path from API: ${relative}`);
    if (await hasMd5(target, file.md5)) continue;
    process.stdout.write(`  ↓ ${id}/${relative}… `);
    const download = await fetch(file.url, { headers: { "User-Agent": USER_AGENT } });
    if (!download.ok) throw new Error(`Download failed (${download.status}): ${file.url}`);
    const bytes = new Uint8Array(await download.arrayBuffer());
    if (md5(bytes) !== file.md5) throw new Error(`Checksum mismatch for ${relative}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    console.log(`${(bytes.byteLength / 1024).toFixed(0)} KB`);
  }
  console.log(`✓ ${id}`);
  return path.join(dir, mainName);
}

function md5(bytes: Uint8Array): string {
  return createHash("md5").update(bytes).digest("hex");
}

async function hasMd5(file: string, expected: string): Promise<boolean> {
  try {
    return md5(await readFile(file)) === expected;
  } catch {
    return false;
  }
}

async function writeGlb(io: Awaited<ReturnType<typeof getIO>>, doc: Document, name: string) {
  await doc.transform(unpartition()); // a .glb holds exactly one binary buffer
  const bytes = await io.writeBinary(doc);
  await mkdir(SOURCES_DIR, { recursive: true });
  await writeFile(path.join(SOURCES_DIR, name), bytes);
  console.log(`  ✓ seed/sources/${name} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

/**
 * Moves `food` into `plate`'s scene, centred and rotated, then "drops" it
 * until it touches the plate's surface (no floating, no intersection).
 */
function placeOnPlate(plate: Document, food: Document, yawDegrees: number) {
  const plateScene = mainScene(plate);
  const plateBounds = sceneBounds(plateScene);
  const plateTriangles = collectTriangles(plateScene);

  const foodSceneOriginal = mainScene(food);
  const map = mergeDocuments(plate, food);
  const foodScene = map.get(foodSceneOriginal) as Scene;
  const fb = sceneBounds(foodScene);

  // Inner node: food centred on X/Z with its lowest point at Y = 0.
  const inner = plate.createNode("FoodCentered").setTranslation([
    -(fb.min[0] + fb.max[0]) / 2,
    -fb.min[1],
    -(fb.min[2] + fb.max[2]) / 2,
  ]);
  for (const child of foodScene.listChildren()) {
    foodScene.removeChild(child);
    inner.addChild(child);
  }
  foodScene.dispose();

  // Outer node: rotation + position above the plate centre.
  const half = (yawDegrees * Math.PI) / 360;
  const outer = plate
    .createNode("Food")
    .setRotation([0, Math.sin(half), 0, Math.cos(half)])
    .setTranslation([(plateBounds.min[0] + plateBounds.max[0]) / 2, plateBounds.max[1] + 0.05, (plateBounds.min[2] + plateBounds.max[2]) / 2]);
  outer.addChild(inner);
  plateScene.addChild(outer);

  // Smallest gap between any food vertex and the plate surface right below it.
  let drop = Infinity;
  const el = [0, 0, 0];
  outer.traverse((node) => {
    const mesh = node.getMesh();
    if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        const [x, y, z] = transformPoint(m, el[0], el[1], el[2]);
        const surface = surfaceHeight(plateTriangles, x, z);
        if (surface !== null) drop = Math.min(drop, y - surface);
      }
    }
  });
  if (!Number.isFinite(drop)) drop = 0.05; // nothing below: rest on the rim height
  const t = outer.getTranslation();
  outer.setTranslation([t[0], t[1] - drop, t[2]]);
}

function collectTriangles(scene: Scene): Float64Array[] {
  const triangles: Float64Array[] = [];
  const el = [0, 0, 0];
  forEachMeshNode(scene, (node) => {
    const m = node.getWorldMatrix();
    for (const prim of node.getMesh()!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const idx = prim.getIndices();
      if (!pos) continue;
      const count = idx ? idx.getCount() : pos.getCount();
      for (let t = 0; t + 2 < count; t += 3) {
        const tri = new Float64Array(9);
        for (let k = 0; k < 3; k++) {
          pos.getElement(idx ? idx.getScalar(t + k) : t + k, el);
          tri.set(transformPoint(m, el[0], el[1], el[2]), k * 3);
        }
        triangles.push(tri);
      }
    }
  });
  return triangles;
}

/** Highest Y of the triangles found directly below/above (x, z), or null. */
function surfaceHeight(triangles: Float64Array[], x: number, z: number): number | null {
  let best: number | null = null;
  for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of triangles) {
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
    const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 < 0 || l2 < 0 || l3 < 0) continue;
    const y = l1 * ay + l2 * by + l3 * cy;
    if (best === null || y > best) best = y;
  }
  return best;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

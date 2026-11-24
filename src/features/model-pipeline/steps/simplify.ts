import type { Document } from "@gltf-transform/core";
import { prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import { countTriangles } from "../geometry";

function totalTriangles(doc: Document): number {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) n += countTriangles(prim);
  }
  return n;
}

/**
 * Reduces the triangle count of heavy scans (often 500k–2M triangles) down to
 * `maxTriangles`. Visual detail on food scans lives mostly in the textures, so
 * 50–80k triangles look the same on a phone while loading much faster.
 *
 * `error` is the allowed deviation as a fraction of the mesh size. We start
 * strict and loosen once if the target isn't reached.
 */
export async function simplifyModel(doc: Document, maxTriangles: number): Promise<{ before: number; after: number }> {
  const before = totalTriangles(doc);
  if (before <= maxTriangles) return { before, after: before };

  await MeshoptSimplifier.ready;
  for (const error of [0.005, 0.02]) {
    const current = totalTriangles(doc);
    if (current <= maxTriangles) break;
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: maxTriangles / current, error }),
      prune(),
    );
  }
  return { before, after: totalTriangles(doc) };
}

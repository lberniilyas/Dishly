import type { Document, Primitive } from "@gltf-transform/core";
import { dedup, dequantize, prune, weld } from "@gltf-transform/functions";
import { MODE_TRIANGLES, mainScene, readIndices } from "../geometry";
import { PipelineError } from "../types";

/**
 * Normalises whatever the scanning app exported into a clean, simple model:
 *  - keep only the main scene, drop cameras/animations/skins (useless for a dish)
 *  - drop point/line primitives (some apps export point clouds)
 *  - un-quantize geometry so every later step can rely on float positions
 *  - add smooth normals when the file has none (otherwise lighting looks flat)
 *  - merge duplicate vertices/materials/textures and remove unused data
 */
export async function cleanupModel(doc: Document, warnings: string[]): Promise<void> {
  const root = doc.getRoot();
  const scene = mainScene(doc);

  for (const other of root.listScenes()) if (other !== scene) other.dispose();
  root.setDefaultScene(scene);
  for (const animation of root.listAnimations()) animation.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  for (const camera of root.listCameras()) camera.dispose();

  let droppedNonTriangles = false;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== MODE_TRIANGLES || !prim.getAttribute("POSITION")) {
        prim.dispose();
        droppedNonTriangles = true;
      }
    }
  }
  if (droppedNonTriangles) {
    warnings.push("Certaines parties du fichier (points ou lignes) ont été ignorées : seuls les triangles sont affichés.");
  }

  await doc.transform(dequantize(), dedup(), prune(), weld());

  let addedNormals = false;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (!prim.getAttribute("NORMAL")) {
        addSmoothNormals(doc, prim);
        addedNormals = true;
      }
    }
  }
  if (addedNormals) await doc.transform(prune());

  const hasGeometry = root.listMeshes().some((m) => m.listPrimitives().length > 0);
  if (!hasGeometry) {
    throw new PipelineError("Ce fichier ne contient aucun objet 3D affichable.");
  }
}

/** Area-weighted vertex normals (smooth shading) for a welded, indexed primitive. */
function addSmoothNormals(doc: Document, prim: Primitive): void {
  const pos = prim.getAttribute("POSITION")!;
  const count = pos.getCount();
  const p = new Float32Array(count * 3);
  const el = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    pos.getElement(i, el);
    p.set(el, i * 3);
  }
  const idx = readIndices(prim);
  const n = new Float32Array(count * 3);
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    // Cross product length is proportional to triangle area → natural weighting.
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      n[v] += nx;
      n[v + 1] += ny;
      n[v + 2] += nz;
    }
  }
  for (let i = 0; i < count; i++) {
    const len = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1;
    n[i * 3] /= len;
    n[i * 3 + 1] /= len;
    n[i * 3 + 2] /= len;
  }
  const buffer = doc.getRoot().listBuffers()[0] ?? doc.createBuffer();
  prim.setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(n).setBuffer(buffer));
}

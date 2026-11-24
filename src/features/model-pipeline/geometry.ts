import type { Document, Node, Primitive, Scene } from "@gltf-transform/core";
import type { SizeCm } from "./types";

/**
 * Small geometry helpers shared by the pipeline steps.
 * glTF matrices are column-major arrays of 16 numbers.
 */

export type Mat4 = ArrayLike<number>;
export type Vec3 = [number, number, number];

/** TRIANGLES draw mode (the only one we keep). */
export const MODE_TRIANGLES = 4;

export function transformPoint(m: Mat4, x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/**
 * Matrix used to transform normals: inverse-transpose of the upper 3x3.
 * Returned as a row-major 3x3 plus the determinant (negative = mirrored,
 * which means triangle winding must be flipped).
 */
export function normalMatrix(m: Mat4): { n: number[]; det: number } {
  // Upper 3x3, row-major: a[row][col] = m[col * 4 + row]
  const a00 = m[0], a01 = m[4], a02 = m[8];
  const a10 = m[1], a11 = m[5], a12 = m[9];
  const a20 = m[2], a21 = m[6], a22 = m[10];
  const c00 = a11 * a22 - a12 * a21;
  const c01 = -(a10 * a22 - a12 * a20);
  const c02 = a10 * a21 - a11 * a20;
  const det = a00 * c00 + a01 * c01 + a02 * c02;
  const inv = det === 0 ? 0 : 1 / det;
  // inverse = adjugate / det; inverse-transpose = cofactor matrix / det
  const c10 = -(a01 * a22 - a02 * a21);
  const c11 = a00 * a22 - a02 * a20;
  const c12 = -(a00 * a21 - a01 * a20);
  const c20 = a01 * a12 - a02 * a11;
  const c21 = -(a00 * a12 - a02 * a10);
  const c22 = a00 * a11 - a01 * a10;
  return {
    n: [c00 * inv, c01 * inv, c02 * inv, c10 * inv, c11 * inv, c12 * inv, c20 * inv, c21 * inv, c22 * inv],
    det,
  };
}

export function transformNormal(n: number[], x: number, y: number, z: number): Vec3 {
  const nx = n[0] * x + n[1] * y + n[2] * z;
  const ny = n[3] * x + n[4] * y + n[5] * z;
  const nz = n[6] * x + n[7] * y + n[8] * z;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** Calls `fn` for every node of the scene that carries a mesh, depth-first. */
export function forEachMeshNode(scene: Scene, fn: (node: Node) => void): void {
  scene.traverse((node) => {
    if (node.getMesh()) fn(node);
  });
}

/** Index list of a primitive (generates 0..n-1 for non-indexed geometry). */
export function readIndices(prim: Primitive): Uint32Array {
  const indices = prim.getIndices();
  if (indices) return Uint32Array.from(indices.getArray() as ArrayLike<number>);
  const count = prim.getAttribute("POSITION")?.getCount() ?? 0;
  const out = new Uint32Array(count);
  for (let i = 0; i < count; i++) out[i] = i;
  return out;
}

export function countTriangles(prim: Primitive): number {
  if (prim.getMode() !== MODE_TRIANGLES) return 0;
  const indices = prim.getIndices();
  const count = indices ? indices.getCount() : (prim.getAttribute("POSITION")?.getCount() ?? 0);
  return Math.floor(count / 3);
}

/** World-space axis-aligned bounds of every vertex in the scene. */
export function sceneBounds(scene: Scene): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  const el = [0, 0, 0];
  forEachMeshNode(scene, (node) => {
    const m = node.getWorldMatrix();
    for (const prim of node.getMesh()!.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, el);
        const p = transformPoint(m, el[0], el[1], el[2]);
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k];
          if (p[k] > max[k]) max[k] = p[k];
        }
      }
    }
  });
  return { min, max };
}

export function boundsSizeCm(b: { min: Vec3; max: Vec3 }): SizeCm {
  if (!Number.isFinite(b.min[0])) return { x: 0, y: 0, z: 0 };
  const r = (v: number) => Math.round(v * 1000) / 10; // metres → cm, 1 decimal
  return { x: r(b.max[0] - b.min[0]), y: r(b.max[1] - b.min[1]), z: r(b.max[2] - b.min[2]) };
}

/** The scene we publish: the default scene, or the first one. */
export function mainScene(doc: Document): Scene {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) throw new Error("Document has no scene");
  return scene;
}

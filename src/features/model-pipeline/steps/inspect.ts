import { ImageUtils, type Document } from "@gltf-transform/core";
import { listTextureSlots } from "@gltf-transform/functions";
import { boundsSizeCm, countTriangles, forEachMeshNode, mainScene, sceneBounds } from "../geometry";
import type { ModelStats } from "../types";

/** Read-only summary of a model: triangle count, textures, real-world size. */
export function inspectModel(doc: Document): ModelStats {
  const root = doc.getRoot();
  const scene = mainScene(doc);

  let triangles = 0;
  let vertices = 0;
  forEachMeshNode(scene, (node) => {
    for (const prim of node.getMesh()!.listPrimitives()) {
      triangles += countTriangles(prim);
      vertices += prim.getAttribute("POSITION")?.getCount() ?? 0;
    }
  });

  const textures = root.listTextures().map((texture) => {
    const image = texture.getImage();
    const mimeType = texture.getMimeType();
    const size = image ? ImageUtils.getSize(image, mimeType) : null;
    return {
      name: texture.getName() || texture.getURI() || "texture",
      mimeType,
      width: size?.[0] ?? null,
      height: size?.[1] ?? null,
      bytes: image?.byteLength ?? 0,
      slots: listTextureSlots(texture),
    };
  });

  return {
    triangles,
    vertices,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures,
    sizeCm: boundsSizeCm(sceneBounds(scene)),
  };
}

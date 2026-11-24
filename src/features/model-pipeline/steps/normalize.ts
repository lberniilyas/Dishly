import type { Document } from "@gltf-transform/core";
import { boundsSizeCm, mainScene, sceneBounds } from "../geometry";
import { PipelineError, type SizeCm } from "../types";

/**
 * Bakes real-world size and placement INTO the file.
 *
 * Why in the file and not with model-viewer's `scale` attribute? On Android,
 * Scene Viewer receives the raw .glb URL, and on iPhone, AR Quick Look opens
 * the .usdz: both ignore attributes set on the web page. Only what is inside
 * the file counts. glTF and USDZ both use metres, so 1 unit = 1 m.
 *
 * After this step:
 *  - the largest horizontal dimension equals `targetSizeCm` (if given)
 *  - the model is centred on X/Z
 *  - its lowest point sits at Y = 0, so in AR it rests ON the table
 *    instead of floating above or sinking into it.
 */
export function normalizeModel(
  doc: Document,
  targetSizeCm: number | null | undefined,
  warnings: string[],
): { detectedSizeCm: SizeCm; scaleFactor: number } {
  const scene = mainScene(doc);
  const bounds = sceneBounds(scene);
  const detectedSizeCm = boundsSizeCm(bounds);
  const footprintM = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  if (!(footprintM > 0)) throw new PipelineError("Impossible de mesurer ce modèle (il semble vide ou plat).");

  let scaleFactor = 1;
  if (targetSizeCm != null) {
    if (!(targetSizeCm >= 1 && targetSizeCm <= 200)) {
      throw new PipelineError("La taille réelle doit être comprise entre 1 et 200 cm.");
    }
    scaleFactor = targetSizeCm / 100 / footprintM;
  } else {
    const cm = footprintM * 100;
    if (cm < 2 || cm > 150) {
      warnings.push(
        `La taille détectée (${Math.round(cm * 10) / 10} cm) semble anormale pour un plat. Indiquez la taille réelle pour un affichage AR correct.`,
      );
    }
  }

  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const bottom = bounds.min[1];

  // Wrap everything in one root node carrying the scale + offset.
  // glTF applies T·R·S, so p' = s·p + t, hence t = -s·(centre).
  const wrapper = doc.createNode("DishlyRoot");
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrapper.addChild(child);
  }
  scene.addChild(wrapper);
  wrapper.setScale([scaleFactor, scaleFactor, scaleFactor]);
  wrapper.setTranslation([-cx * scaleFactor, -bottom * scaleFactor, -cz * scaleFactor]);

  return { detectedSizeCm, scaleFactor };
}

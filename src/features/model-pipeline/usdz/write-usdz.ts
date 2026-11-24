import type { Document, Material, Primitive, Texture, TextureInfo } from "@gltf-transform/core";
import sharp from "sharp";
import {
  forEachMeshNode,
  mainScene,
  MODE_TRIANGLES,
  normalMatrix,
  readIndices,
  transformNormal,
  transformPoint,
  type Mat4,
} from "../geometry";
import { writeUsdzArchive, type ZipEntry } from "./zip";

/**
 * Converts an (already optimized + normalized) glTF document into a .usdz file
 * for iPhone AR Quick Look.
 *
 * We write USDA (the text flavour of USD) — the same approach as three.js's
 * USDZExporter, which model-viewer uses and which Quick Look opens fine.
 * The layout mirrors that exporter:
 *
 *   /Root                       Xform
 *     /Scenes (sceneLibrary)    Scope
 *       /Scene                  Xform  ← "anchor on a horizontal plane" hint
 *         /Mesh_0 …             Mesh   (world transforms baked into points)
 *     /Materials                Scope
 *       /Material_0 …           UsdPreviewSurface + UsdUVTexture shaders
 *
 * Units: metres (metersPerUnit = 1), Y up — identical to glTF, so the real
 * size baked in by the normalize step carries over exactly.
 */

const WRAP_MODES: Record<number, string> = { 10497: "repeat", 33071: "clamp", 33648: "mirror" };
const MATERIALS_PATH = "/Root/Materials";

export async function writeUsdz(doc: Document, warnings: string[]): Promise<Uint8Array> {
  const scene = mainScene(doc);
  const files: ZipEntry[] = [];

  // ---- Textures ---------------------------------------------------------
  const textureFiles = new Map<Texture, string | null>();
  async function textureFile(texture: Texture | null): Promise<string | null> {
    if (!texture) return null;
    if (textureFiles.has(texture)) return textureFiles.get(texture)!;
    const image = texture.getImage();
    const mime = texture.getMimeType();
    const index = textureFiles.size;
    let name: string | null = null;
    if (image && (mime === "image/jpeg" || mime === "image/png")) {
      name = `textures/tex_${index}.${mime === "image/png" ? "png" : "jpg"}`;
      files.push({ name, data: image });
    } else if (image && mime !== "image/ktx2") {
      // WebP / AVIF: Quick Look only reads PNG and JPEG, so convert.
      name = `textures/tex_${index}.png`;
      files.push({ name, data: new Uint8Array(await sharp(image).png().toBuffer()) });
    } else if (image) {
      warnings.push("Une texture KTX2 n'a pas pu être convertie pour l'AR iPhone.");
    }
    textureFiles.set(texture, name);
    return name;
  }

  // ---- Collect primitives (world transform baked in) ---------------------
  const prims: { prim: Primitive; matrix: Mat4 }[] = [];
  forEachMeshNode(scene, (node) => {
    const matrix = node.getWorldMatrix();
    for (const prim of node.getMesh()!.listPrimitives()) {
      if (prim.getMode() === MODE_TRIANGLES && prim.getAttribute("POSITION")) prims.push({ prim, matrix });
    }
  });

  // ---- Materials ----------------------------------------------------------
  const materialNames = new Map<Material | null, string>();
  const materialBlocks: string[] = [];
  for (const { prim } of prims) {
    const material = prim.getMaterial();
    if (materialNames.has(material)) continue;
    const name = `Material_${materialNames.size}`;
    materialNames.set(material, name);
    materialBlocks.push(await buildMaterial(material, name, textureFile, warnings));
  }

  // ---- Meshes ---------------------------------------------------------------
  const meshBlocks = prims.map(({ prim, matrix }, i) =>
    buildMesh(prim, matrix, `Mesh_${i}`, `${MATERIALS_PATH}/${materialNames.get(prim.getMaterial())}`),
  );

  const usda = `#usda 1.0
(
    customLayerData = {
        string creator = "Dishly model pipeline"
    }
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
)

def Xform "Root"
{
    def Scope "Scenes" (
        kind = "sceneLibrary"
    )
    {
        def Xform "Scene" (
            customData = {
                bool preliminary_collidesWithEnvironment = 0
                string sceneName = "Scene"
            }
            sceneName = "Scene"
        )
        {
            token preliminary:anchoring:type = "plane"
            token preliminary:planeAnchoring:alignment = "horizontal"

${meshBlocks.join("\n")}
        }
    }

    def Scope "Materials"
    {
${materialBlocks.join("\n")}
    }
}
`;

  // The main layer must be the first file of the archive.
  return writeUsdzArchive([{ name: "model.usda", data: new TextEncoder().encode(usda) }, ...files]);
}

// ---------------------------------------------------------------------------

type TextureFileFn = (texture: Texture | null) => Promise<string | null>;

async function buildMaterial(
  material: Material | null,
  name: string,
  textureFile: TextureFileFn,
  warnings: string[],
): Promise<string> {
  const path = `${MATERIALS_PATH}/${name}`;
  const inputs: string[] = [];
  const shaders: string[] = [];

  const addTexture = (
    shaderName: string,
    file: string,
    info: TextureInfo | null,
    colorSpace: "sRGB" | "raw",
    outputs: string[],
    scale?: number[],
    bias?: number[],
  ) => {
    if (info && info.getTexCoord() !== 0) {
      warnings.push("Une texture utilise un second jeu d'UV : elle peut mal s'afficher sur iPhone.");
    }
    const wrapS = WRAP_MODES[info?.getWrapS() ?? 10497] ?? "repeat";
    const wrapT = WRAP_MODES[info?.getWrapT() ?? 10497] ?? "repeat";
    shaders.push(
      [
        `            def Shader "${shaderName}"`,
        `            {`,
        `                uniform token info:id = "UsdUVTexture"`,
        `                asset inputs:file = @${file}@`,
        `                float2 inputs:st.connect = <${path}/PrimvarReader_st.outputs:result>`,
        `                token inputs:sourceColorSpace = "${colorSpace}"`,
        `                token inputs:wrapS = "${wrapS}"`,
        `                token inputs:wrapT = "${wrapT}"`,
        scale ? `                float4 inputs:scale = (${scale.map((v) => num(v, 4)).join(", ")})` : null,
        bias ? `                float4 inputs:bias = (${bias.map((v) => num(v, 4)).join(", ")})` : null,
        ...outputs.map((o) => `                ${o}`),
        `            }`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  };

  if (!material) {
    inputs.push("color3f inputs:diffuseColor = (0.8, 0.8, 0.8)", "float inputs:roughness = 0.8", "float inputs:metallic = 0");
  } else {
    // Base colour (glTF factors are linear, like UsdPreviewSurface inputs).
    const bc = material.getBaseColorFactor();
    const baseColorFile = await textureFile(material.getBaseColorTexture());
    if (baseColorFile) {
      addTexture("BaseColorTex", baseColorFile, material.getBaseColorTextureInfo(), "sRGB", ["float3 outputs:rgb", "float outputs:a"], [bc[0], bc[1], bc[2], bc[3]]);
      inputs.push(`color3f inputs:diffuseColor.connect = <${path}/BaseColorTex.outputs:rgb>`);
    } else {
      inputs.push(`color3f inputs:diffuseColor = (${num(bc[0], 4)}, ${num(bc[1], 4)}, ${num(bc[2], 4)})`);
    }

    // Transparency
    const alphaMode = material.getAlphaMode();
    if (alphaMode !== "OPAQUE") {
      inputs.push(baseColorFile ? `float inputs:opacity.connect = <${path}/BaseColorTex.outputs:a>` : `float inputs:opacity = ${num(bc[3], 4)}`);
      if (alphaMode === "MASK") inputs.push(`float inputs:opacityThreshold = ${num(material.getAlphaCutoff(), 4)}`);
    }

    // Roughness (G channel) and metalness (B channel), like glTF.
    const roughness = material.getRoughnessFactor();
    const metallic = material.getMetallicFactor();
    const mrFile = await textureFile(material.getMetallicRoughnessTexture());
    if (mrFile) {
      addTexture("MetalRoughTex", mrFile, material.getMetallicRoughnessTextureInfo(), "raw", ["float outputs:g", "float outputs:b"], [1, roughness, metallic, 1]);
      inputs.push(`float inputs:roughness.connect = <${path}/MetalRoughTex.outputs:g>`);
      inputs.push(`float inputs:metallic.connect = <${path}/MetalRoughTex.outputs:b>`);
    } else {
      inputs.push(`float inputs:roughness = ${num(roughness, 4)}`, `float inputs:metallic = ${num(metallic, 4)}`);
    }

    // Normal map: stored as 0..1 colours, remapped to -1..1 with scale/bias.
    const normalFile = await textureFile(material.getNormalTexture());
    if (normalFile) {
      const s = material.getNormalScale();
      addTexture("NormalTex", normalFile, material.getNormalTextureInfo(), "raw", ["float3 outputs:rgb"], [2 * s, 2 * s, 2, 1], [-s, -s, -1, 0]);
      inputs.push(`normal3f inputs:normal.connect = <${path}/NormalTex.outputs:rgb>`);
    }

    // Ambient occlusion (R channel).
    const occlusionFile = await textureFile(material.getOcclusionTexture());
    if (occlusionFile) {
      addTexture("OcclusionTex", occlusionFile, material.getOcclusionTextureInfo(), "raw", ["float outputs:r"]);
      inputs.push(`float inputs:occlusion.connect = <${path}/OcclusionTex.outputs:r>`);
    }

    // Emissive (rare for food, but cheap to support).
    const em = material.getEmissiveFactor();
    const emissiveFile = await textureFile(material.getEmissiveTexture());
    if (emissiveFile && em.some((v) => v > 0)) {
      addTexture("EmissiveTex", emissiveFile, material.getEmissiveTextureInfo(), "sRGB", ["float3 outputs:rgb"], [em[0], em[1], em[2], 1]);
      inputs.push(`color3f inputs:emissiveColor.connect = <${path}/EmissiveTex.outputs:rgb>`);
    } else if (em.some((v) => v > 0)) {
      inputs.push(`color3f inputs:emissiveColor = (${em.map((v) => num(v, 4)).join(", ")})`);
    }
  }

  const reader =
    shaders.length > 0
      ? `
            def Shader "PrimvarReader_st"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                string inputs:varname = "st"
                float2 inputs:fallback = (0, 0)
                float2 outputs:result
            }
`
      : "";

  return `        def Material "${name}"
        {
            token outputs:surface.connect = <${path}/PreviewSurface.outputs:surface>

            def Shader "PreviewSurface"
            {
                uniform token info:id = "UsdPreviewSurface"
${inputs.map((i) => `                ${i}`).join("\n")}
                int inputs:useSpecularWorkflow = 0
                token outputs:surface
            }
${reader}
${shaders.join("\n\n")}
        }
`;
}

function buildMesh(prim: Primitive, matrix: Mat4, name: string, materialPath: string): string {
  const position = prim.getAttribute("POSITION")!;
  const normal = prim.getAttribute("NORMAL");
  const uv = prim.getAttribute("TEXCOORD_0");
  const count = position.getCount();
  const { n: nMat, det } = normalMatrix(matrix);

  const el = [0, 0, 0];
  const points: string[] = new Array(count);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    position.getElement(i, el);
    const p = transformPoint(matrix, el[0], el[1], el[2]);
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
    // 5 decimals in metres = 0.01 mm precision; fewer digits = smaller file.
    points[i] = `(${num(p[0], 5)}, ${num(p[1], 5)}, ${num(p[2], 5)})`;
  }

  let normals: string[] | null = null;
  if (normal) {
    normals = new Array(count);
    for (let i = 0; i < count; i++) {
      normal.getElement(i, el);
      const v = transformNormal(nMat, el[0], el[1], el[2]);
      normals[i] = `(${num(v[0], 3)}, ${num(v[1], 3)}, ${num(v[2], 3)})`;
    }
  }

  let sts: string[] | null = null;
  if (uv) {
    sts = new Array(count);
    for (let i = 0; i < count; i++) {
      uv.getElement(i, el);
      // glTF puts UV (0,0) at the image's top-left, USD at its bottom-left.
      sts[i] = `(${num(el[0], 5)}, ${num(1 - el[1], 5)})`;
    }
  }

  const indices = readIndices(prim);
  if (det < 0) {
    // A mirrored transform turns triangles inside-out: swap two corners.
    for (let t = 0; t + 2 < indices.length; t += 3) {
      const tmp = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = tmp;
    }
  }
  const triangleCount = Math.floor(indices.length / 3);
  const doubleSided = prim.getMaterial()?.getDoubleSided() ? 1 : 0;

  const lines = [
    `            def Mesh "${name}" (`,
    `                prepend apiSchemas = ["MaterialBindingAPI"]`,
    `            )`,
    `            {`,
    `                uniform bool doubleSided = ${doubleSided}`,
    `                float3[] extent = [(${min.map((v) => num(v, 5)).join(", ")}), (${max.map((v) => num(v, 5)).join(", ")})]`,
    `                int[] faceVertexCounts = [${new Array(triangleCount).fill("3").join(", ")}]`,
    `                int[] faceVertexIndices = [${Array.from(indices.subarray(0, triangleCount * 3)).join(", ")}]`,
    `                rel material:binding = <${materialPath}>`,
    normals ? `                normal3f[] normals = [${normals.join(", ")}] (\n                    interpolation = "vertex"\n                )` : null,
    `                point3f[] points = [${points.join(", ")}]`,
    sts ? `                texCoord2f[] primvars:st = [${sts.join(", ")}] (\n                    interpolation = "vertex"\n                )` : null,
    `                uniform token subdivisionScheme = "none"`,
    `            }`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Compact number formatting: fixed precision, trailing zeros removed. */
function num(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "0";
  let s = value.toFixed(digits);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

/**
 * One shared glTF reader/writer.
 *
 * Registering every extension lets us *read* files that use Draco, Meshopt,
 * quantization, etc. (scanning apps export all sorts of things). The Draco
 * encoder is needed because we *write* Draco-compressed geometry.
 *
 * Creating the WebAssembly modules is slow-ish, so we do it once and reuse.
 */
let ioPromise: Promise<NodeIO> | null = null;

export function getIO(): Promise<NodeIO> {
  ioPromise ??= (async () => {
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
  })();
  return ioPromise;
}

"use client";

import { useEffect, useState } from "react";
import { loadModelViewer } from "@/features/viewer/model-viewer-loader";

/**
 * 3D preview for the owner. The camera stays at a fixed distance (no
 * auto-framing, no zoom) so changing `scale` visibly makes the dish bigger
 * or smaller — that's how the size slider gives a live preview.
 */
export function ModelPreview({ src, scale = 1, poster }: { src: string; scale?: number; poster?: string | null }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void loadModelViewer().then(() => setReady(true));
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_40%,#fffdf9_0%,#e9dfd1_100%)] ring-1 ring-line">
      <model-viewer
        src={src}
        alt="Aperçu 3D"
        camera-controls
        disable-zoom
        auto-rotate
        rotation-per-second="20deg"
        camera-orbit="25deg 62deg 0.95m"
        field-of-view="30deg"
        shadow-intensity="1.1"
        environment-image="neutral"
        tone-mapping="neutral"
        interaction-prompt="none"
        scale={`${scale} ${scale} ${scale}`}
        className="absolute inset-0 h-full w-full"
        style={{ backgroundColor: "transparent", "--poster-color": "transparent" }}
      >
        <span slot="progress-bar" />
      </model-viewer>
      {!ready ? (
        <div className="absolute inset-0 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-resized photo */}
          {poster ? <img src={poster} alt="" className="size-full object-cover opacity-60" /> : <span className="text-sm text-muted">Chargement…</span>}
        </div>
      ) : null}
    </div>
  );
}

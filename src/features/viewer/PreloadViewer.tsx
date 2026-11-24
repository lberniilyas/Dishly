"use client";

import { useEffect } from "react";
import { preloadModelViewerWhenIdle } from "./model-viewer-loader";

/**
 * Placed on the menu page when at least one dish has a 3D model: once the
 * page is idle, downloads the 3D library so opening a dish feels instant.
 * Never delays the menu itself.
 */
export function PreloadViewer() {
  useEffect(() => preloadModelViewerWhenIdle(), []);
  return null;
}

/**
 * AR capability detection — mirrors model-viewer's own rules so our button
 * never promises something the device can't do.
 */

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * iPhone/iPad AR Quick Look. Safari exposes it through `rel="ar"` links;
 * Chrome/Edge/Firefox/DuckDuckGo on iOS support it too. The Google app (GSA)
 * and in-app browsers (Instagram, Facebook…) don't.
 */
export function supportsQuickLook(): boolean {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  if (/GSA\//.test(ua)) return false;
  if (/CriOS\/|EdgiOS\/|FxiOS\/|DuckDuckGo\//.test(ua)) return true;
  const a = document.createElement("a");
  return Boolean(a.relList?.supports?.("ar"));
}

/**
 * Opens AR Quick Look directly with our pre-built .usdz — instant on tap,
 * even before the 3D preview has finished loading.
 * `allowsContentScaling=0` stops pinch-to-resize, so the dish stays at its
 * real size on the table.
 */
export function openQuickLook(usdzUrl: string): void {
  const a = document.createElement("a");
  a.setAttribute("rel", "ar");
  a.href = `${usdzUrl}#allowsContentScaling=0`;
  // Safari only treats the link as AR if its first child is an image.
  a.appendChild(document.createElement("img"));
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    // Free the test context right away: browsers cap how many can exist.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Which Android AR flavour model-viewer will use (for analytics). */
export async function androidArMode(): Promise<"webxr" | "scene-viewer"> {
  try {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
    if (xr && (await xr.isSessionSupported("immersive-ar"))) return "webxr";
  } catch {
    /* ignore */
  }
  return "scene-viewer";
}

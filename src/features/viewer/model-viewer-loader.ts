/**
 * Loads Google's <model-viewer> web component (~250 KB gzipped, includes
 * three.js) only when needed: never on the critical path of the menu page.
 */

let loading: Promise<void> | null = null;

export function loadModelViewer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("model-viewer")) return Promise.resolve();
  loading ??= (async () => {
    // Must be set BEFORE the library loads: serve the Draco decoder (used to
    // unpack our compressed models) from our own domain instead of Google's CDN.
    const w = window as unknown as { ModelViewerElement?: Record<string, unknown> };
    w.ModelViewerElement = { ...(w.ModelViewerElement ?? {}), dracoDecoderLocation: "/draco/" };
    await import("@google/model-viewer");
  })();
  loading.catch(() => {
    loading = null; // allow a retry after a network error
  });
  return loading;
}

/** Warm-up used on the menu page: download the viewer while the diner browses. */
export function preloadModelViewerWhenIdle(): () => void {
  const start = () => void loadModelViewer().catch(() => {});
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(start, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(start, 2500);
  return () => clearTimeout(id);
}

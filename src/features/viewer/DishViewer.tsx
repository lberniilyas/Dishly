"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { detectPlatform, track, type Platform } from "@/features/analytics/client";
import { getDictionary, type Locale } from "@/features/i18n";
import type { PublicModel, PublicPhoto } from "@/features/menu/types";
import { androidArMode, openQuickLook, supportsQuickLook, supportsWebGL } from "./ar-support";
import { loadModelViewer } from "./model-viewer-loader";
import { OpenOnPhone } from "./OpenOnPhone";

/** The parts of the <model-viewer> element API we call. */
type ModelViewerElement = HTMLElement & {
  canActivateAR: boolean;
  loaded: boolean;
  activateAR(): Promise<void>;
};

interface Props {
  restaurantId: string;
  dishId: string;
  dishName: string;
  model: PublicModel;
  photo: PublicPhoto | null;
  locale: Locale;
}

type DeviceInfo = { platform: Platform; quickLook: boolean; webgl: boolean };

// Device capabilities never change during a visit: computed once, in the browser.
let deviceCache: DeviceInfo | null = null;
function getDevice(): DeviceInfo {
  deviceCache ??= { platform: detectPlatform(), quickLook: supportsQuickLook(), webgl: supportsWebGL() };
  return deviceCache;
}
const noSubscription = () => () => {};

/**
 * Interactive 3D preview + "View on your table" button.
 *
 * Loading sequence (what the diner sees):
 *  1. the dish photo immediately (blurred placeholder → sharp photo)
 *  2. a thin progress bar while the 3D model downloads
 *  3. a cross-fade from the photo to the rotating 3D model
 *
 * Fallbacks: no WebGL / model error → the photo stays; desktop → QR code to
 * continue on a phone; mobile browser without AR → a short explanation.
 */
export function DishViewer({ restaurantId, dishId, dishName, model, photo, locale }: Props) {
  const t = getDictionary(locale).dish;
  const viewerRef = useRef<ModelViewerElement | null>(null);

  // null during server rendering, the real capabilities in the browser.
  const device = useSyncExternalStore(noSubscription, getDevice, () => null);
  const webgl = device?.webgl ?? true;
  const [androidMode, setAndroidMode] = useState<"webxr" | "scene-viewer" | null>(null);
  const [libReady, setLibReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [canActivateAR, setCanActivateAR] = useState(false);
  /** true once model-viewer had time to decide whether AR is possible */
  const [arChecked, setArChecked] = useState(false);
  const [arBusy, setArBusy] = useState(false);

  // 1. Load the <model-viewer> library (client-side only), then ask it
  //    whether AR is possible — it decides asynchronously on Android.
  useEffect(() => {
    let cancelled = false;
    if (detectPlatform() === "android") {
      void androidArMode().then((mode) => !cancelled && setAndroidMode(mode));
    }
    loadModelViewer()
      .then(() => {
        if (cancelled) return;
        setLibReady(true);
        const check = () => setCanActivateAR(Boolean(viewerRef.current?.canActivateAR));
        requestAnimationFrame(check);
        setTimeout(() => {
          if (cancelled) return;
          check();
          setArChecked(true);
        }, 800);
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Listen to the viewer's events. Listeners are attached before the
  //    library upgrades the element, so no event can be missed.
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onProgress = (e: Event) => setProgress((e as CustomEvent<{ totalProgress: number }>).detail.totalProgress);
    const onLoad = () => {
      setStatus("loaded");
      setCanActivateAR(Boolean(el.canActivateAR));
      setArChecked(true);
      track({ type: "model_loaded", restaurantId, dishId });
    };
    const onError = () => setStatus("error");
    el.addEventListener("progress", onProgress);
    el.addEventListener("load", onLoad);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("load", onLoad);
      el.removeEventListener("error", onError);
    };
  }, [restaurantId, dishId]);

  const isMobile = device?.platform === "ios" || device?.platform === "android";
  // iPhone with a pre-built .usdz: AR works instantly, even before the preview loads.
  const quickLookReady = Boolean(device?.quickLook && (model.usdzUrl || libReady));
  const arAvailable = quickLookReady || canActivateAR;
  // Until model-viewer has decided, show the button (disabled) rather than a
  // premature "AR unavailable" message.
  const arUnknownYet = isMobile && !arAvailable && !arChecked && status !== "error";

  async function handleViewOnTable() {
    const el = viewerRef.current;
    if (device?.quickLook) {
      track({ type: "ar_launch", restaurantId, dishId, arMode: "quick-look" });
      if (model.usdzUrl) {
        openQuickLook(model.usdzUrl);
        return;
      }
      // No pre-built file: model-viewer converts the .glb to .usdz on the fly.
      setArBusy(true);
      try {
        await loadModelViewer();
        await el?.activateAR();
      } finally {
        setArBusy(false);
      }
      return;
    }
    if (el?.canActivateAR) {
      track({ type: "ar_launch", restaurantId, dishId, arMode: androidMode ?? "scene-viewer" });
      await el.activateAR();
    }
  }

  const posterSrc = photo?.lgUrl ?? model.posterUrl;
  const showPoster = status !== "loaded" || !webgl;

  return (
    <>
      <div className="relative aspect-square max-h-[62svh] w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#fffdf9_0%,#efe6da_100%)]">
        <model-viewer
          ref={viewerRef as Ref<HTMLElement>}
          src={model.glbUrl}
          ios-src={model.usdzUrl ?? undefined}
          alt={`${dishName} — modèle 3D`}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          ar-placement="floor"
          camera-controls
          touch-action="pan-y"
          auto-rotate
          auto-rotate-delay="2500"
          rotation-per-second="14deg"
          interaction-prompt="none"
          camera-orbit="20deg 62deg auto"
          min-camera-orbit="auto 10deg auto"
          max-camera-orbit="auto 88deg auto"
          shadow-intensity="1.2"
          shadow-softness="0.85"
          environment-image="neutral"
          exposure="1.05"
          tone-mapping="neutral"
          loading="eager"
          className="absolute inset-0 h-full w-full"
          style={{ backgroundColor: "transparent", "--poster-color": "transparent" }}
        >
          {/* We draw our own AR button and progress bar. */}
          <span slot="ar-button" hidden />
          <span slot="progress-bar" />
        </model-viewer>

        {/* Photo shown until the 3D model is ready (and kept if 3D isn't possible). */}
        <div
          aria-hidden={!showPoster}
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${showPoster ? "opacity-100" : "opacity-0"}`}
        >
          {posterSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- pre-resized at upload, served by the CDN
            <img
              src={posterSrc}
              alt=""
              className="h-full w-full object-cover"
              style={photo ? { backgroundImage: `url(${photo.blurDataUrl})`, backgroundSize: "cover" } : undefined}
              fetchPriority="high"
              decoding="async"
            />
          ) : null}
        </div>

        {status === "loading" && webgl ? (
          <>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/5">
              <div className="h-full bg-brand transition-[width] duration-300" style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
            <p className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur">
              {t.loading3d}
            </p>
          </>
        ) : null}

        {status === "error" || !webgl ? (
          <p className="absolute inset-x-4 bottom-4 rounded-xl bg-white/90 px-3 py-2 text-center text-xs text-muted shadow-sm">
            {webgl ? t.loadError : t.noWebgl}
          </p>
        ) : null}

        {status === "loaded" && webgl ? (
          <p className="animate-fade-out pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-ink/75 px-3 py-1 text-xs font-medium text-white">
            {t.rotateHint}
          </p>
        ) : null}
      </div>

      {device?.platform === "desktop" ? (
        <div className="mx-auto mt-6 w-full max-w-xl px-5">
          <OpenOnPhone title={t.openOnPhoneTitle} text={t.openOnPhoneText} />
        </div>
      ) : null}

      {isMobile ? (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-cream via-cream/95 to-cream/0 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {arAvailable || arUnknownYet ? (
            <button
              type="button"
              onClick={handleViewOnTable}
              disabled={!arAvailable || arBusy}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-brand text-base font-semibold text-brand-ink shadow-lg shadow-black/10 transition active:scale-[0.98] disabled:opacity-60"
            >
              <ArIcon />
              {arBusy ? t.arPreparing : t.viewOnTable}
            </button>
          ) : (
            <p className="rounded-2xl bg-white px-4 py-3 text-center text-sm text-muted shadow-sm">{t.arUnavailable}</p>
          )}
        </div>
      ) : null}
    </>
  );
}

function ArIcon() {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </svg>
  );
}


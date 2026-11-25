/**
 * TypeScript support for the <model-viewer> custom element in JSX.
 * Only the attributes we use are listed. Docs: https://modelviewer.dev/docs
 */
import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  "ios-src"?: string;
  alt?: string;
  poster?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "manual";
  ar?: boolean;
  "ar-modes"?: string;
  "ar-scale"?: "auto" | "fixed";
  "ar-placement"?: "floor" | "wall";
  "camera-controls"?: boolean;
  "disable-zoom"?: boolean;
  scale?: string;
  "touch-action"?: "pan-y" | "pan-x" | "none";
  "auto-rotate"?: boolean;
  "auto-rotate-delay"?: string;
  "rotation-per-second"?: string;
  "interaction-prompt"?: "auto" | "none";
  "interaction-prompt-threshold"?: string;
  "camera-orbit"?: string;
  "min-camera-orbit"?: string;
  "max-camera-orbit"?: string;
  "field-of-view"?: string;
  "shadow-intensity"?: string;
  "shadow-softness"?: string;
  "environment-image"?: string;
  exposure?: string;
  "tone-mapping"?: string;
  style?: CSSProperties & Record<`--${string}`, string>;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

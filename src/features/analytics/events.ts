import { z } from "zod";

/**
 * Analytics event format, shared by the browser (sender) and /api/track
 * (validator). These counts are what restaurants pay for, so the server
 * rejects anything that doesn't match exactly.
 *
 *  menu_view     the menu page was opened (scan of the QR code)
 *  dish_view     a dish page was opened
 *  model_loaded  the 3D model finished loading and was displayed
 *  ar_launch     the diner tapped "Voir sur votre table"
 *                (iPhone/Scene Viewer don't report whether AR really opened,
 *                 so this is the tap; on Android WebXR it's equivalent)
 */
export const EVENT_TYPES = ["menu_view", "dish_view", "model_loaded", "ar_launch"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const trackEventSchema = z.object({
  /** Random id per event: makes retries idempotent (stored as dedupe_key). */
  eventId: z.uuid(),
  type: z.enum(EVENT_TYPES),
  restaurantId: z.uuid(),
  dishId: z.uuid().nullish(),
  /** Random id per browser tab visit (sessionStorage). */
  sessionId: z.uuid(),
  table: z
    .string()
    .max(20)
    .regex(/^[\p{L}\p{N} _-]+$/u)
    .nullish(),
  locale: z.string().max(10).nullish(),
  platform: z.enum(["ios", "android", "desktop", "other"]),
  arMode: z.enum(["quick-look", "scene-viewer", "webxr"]).nullish(),
});

export type TrackEvent = z.infer<typeof trackEventSchema>;

export const TRACK_ENDPOINT = "/api/track";

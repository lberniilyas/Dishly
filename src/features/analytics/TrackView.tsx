"use client";

import { useEffect } from "react";
import { rememberTable, track } from "./client";
import type { EventType } from "./events";

/** Invisible component: records a page view when it mounts. */
export function TrackView({ type, restaurantId, dishId }: { type: EventType; restaurantId: string; dishId?: string }) {
  useEffect(() => {
    rememberTable(); // keep ?table=… from the QR code for the rest of the visit
    track({ type, restaurantId, dishId });
  }, [type, restaurantId, dishId]);
  return null;
}

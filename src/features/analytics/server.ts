import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TrackEvent } from "./events";

/** Crawlers, link previews and monitoring bots must not inflate the stats. */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|preview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|node-fetch|axios/i;

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/**
 * Stores one event. `dedupe_key` is unique in the database, so a retried
 * request (same eventId) is silently ignored instead of counted twice.
 */
export async function insertEvent(event: TrackEvent): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("events").upsert(
    {
      restaurant_id: event.restaurantId,
      dish_id: event.dishId ?? null,
      type: event.type,
      session_id: event.sessionId,
      table_label: event.table ?? null,
      locale: event.locale ?? null,
      platform: event.platform,
      ar_mode: event.arMode ?? null,
      dedupe_key: event.eventId,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  // Unknown restaurant/dish ids fail the foreign keys: log, don't crash.
  if (error) console.warn("[analytics] event not stored:", error.message);
}

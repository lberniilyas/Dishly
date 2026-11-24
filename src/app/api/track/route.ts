import { after } from "next/server";
import { trackEventSchema } from "@/features/analytics/events";
import { insertEvent, isBot } from "@/features/analytics/server";

/**
 * POST /api/track — receives analytics beacons from diners' phones.
 *
 * Responds 204 immediately; the database insert runs right after the
 * response is sent (`after`), so the phone never waits on the database.
 */
export async function POST(request: Request) {
  if (isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) return new Response(null, { status: 413 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = trackEventSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });

  after(() => insertEvent(parsed.data));
  return new Response(null, { status: 204 });
}

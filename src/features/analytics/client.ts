import { TRACK_ENDPOINT, type EventType, type TrackEvent } from "./events";

/**
 * Browser-side analytics. Tiny on purpose: no third-party script, events go
 * to our own /api/track (first-party → not blocked by most ad blockers).
 */

const SESSION_KEY = "dishly.session";
const TABLE_KEY = "dishly.table";
const TABLE_PATTERN = /^[\p{L}\p{N} _-]{1,20}$/u;

function randomId(): string {
  const c = globalThis.crypto;
  // crypto.randomUUID needs HTTPS (or localhost); fall back for plain-http LAN testing.
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function storageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null; // private mode / storage disabled
  }
}

function storageSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** One id per visit (per browser tab): a new QR scan = a new session. */
export function getSessionId(): string {
  let id = storageGet(SESSION_KEY);
  if (!id) {
    id = randomId();
    storageSet(SESSION_KEY, id);
  }
  return id;
}

/*
 * The table number only appears in the QR code URL (?table=5) of the first
 * page. We remember it for the rest of the visit (dish pages don't carry it).
 * It is read here, in the browser, so the menu page itself stays cacheable.
 */
function tableFromUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get("table")?.trim();
  return value && TABLE_PATTERN.test(value) ? value : null;
}

/** Current table: from the URL, else what we remembered. Pure read. */
export function readTable(): string | null {
  return tableFromUrl() ?? storageGet(TABLE_KEY);
}

/** Saves the table from the QR code URL for the rest of the visit. */
export function rememberTable(): string | null {
  const fromUrl = tableFromUrl();
  if (fromUrl) storageSet(TABLE_KEY, fromUrl);
  return readTable();
}

export type Platform = TrackEvent["platform"];

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac: touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return "desktop";
  return "other";
}

/** Same event fired twice within 1 s (e.g. React dev double-mount) is sent once. */
const recent = new Map<string, number>();

export function track(event: {
  type: EventType;
  restaurantId: string;
  dishId?: string | null;
  arMode?: TrackEvent["arMode"];
}): void {
  if (typeof window === "undefined") return;
  const key = `${event.type}:${event.restaurantId}:${event.dishId ?? ""}`;
  const now = Date.now();
  if (now - (recent.get(key) ?? 0) < 1000) return;
  recent.set(key, now);

  const payload: TrackEvent = {
    eventId: randomId(),
    type: event.type,
    restaurantId: event.restaurantId,
    dishId: event.dishId ?? null,
    sessionId: getSessionId(),
    table: rememberTable(),
    locale: document.documentElement.lang || null,
    platform: detectPlatform(),
    arMode: event.arMode ?? null,
  };
  const body = JSON.stringify(payload);

  // sendBeacon is delivered even if the page is closing — important for
  // "ar_launch": on iPhone, Safari hands over to AR Quick Look right after.
  try {
    if (navigator.sendBeacon?.(TRACK_ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through */
  }
  fetch(TRACK_ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}

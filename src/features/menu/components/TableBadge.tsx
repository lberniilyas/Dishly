"use client";

import { useSyncExternalStore } from "react";
import { readTable } from "@/features/analytics/client";
import { getDictionary, type Locale } from "@/features/i18n";

const noSubscription = () => () => {};

/**
 * "Table 5" chip, from the QR code URL (?table=5). Read in the browser so the
 * menu page itself stays identical for every table (and fully cacheable).
 * useSyncExternalStore: renders nothing on the server, the value in the browser.
 */
export function TableBadge({ locale }: { locale: Locale }) {
  const table = useSyncExternalStore(noSubscription, readTable, () => null);
  if (!table) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink ring-1 ring-line">
      {getDictionary(locale).menu.table(table)}
    </span>
  );
}

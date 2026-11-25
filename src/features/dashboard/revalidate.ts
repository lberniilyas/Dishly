import "server-only";
import { refresh, updateTag } from "next/cache";
import { menuCacheTag } from "@/features/menu/queries";

/**
 * Call at the end of every Server Action that changes menu content:
 *  - updateTag: the public menu (cached for diners) is rebuilt on its next visit,
 *    so the owner sees their change on the QR menu immediately;
 *  - refresh: the dashboard page the owner is looking at re-renders.
 */
export function menuChanged(...slugs: string[]) {
  for (const slug of new Set(slugs)) updateTag(menuCacheTag(slug));
  refresh();
}

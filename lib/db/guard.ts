import type { IntelligenceItem } from "@/lib/types";

/**
 * Hosts that can never be a real source. Mock fixtures use example.com, and
 * a record carrying one is by definition invented — it must never be stored
 * next to real intelligence, and must never be rendered as though a
 * publication reported it.
 */
const FABRICATED_HOST = /^https?:\/\/(www\.)?(example\.(com|org|net)|localhost|test\.invalid)/i;

/** True when this record cannot have come from a real public source. */
export function isFabricated(item: Pick<IntelligenceItem, "sourceUrl">): boolean {
  const url = item.sourceUrl ?? "";
  if (!url) return true;
  if (FABRICATED_HOST.test(url)) return true;
  return !/^https?:\/\//i.test(url);
}

/**
 * Drop invented records. Applied on every write AND every read, so a store
 * already poisoned by an earlier build heals itself rather than needing a
 * manual purge — on serverless there is no console to run one from.
 */
export function rejectFabricated<T extends Pick<IntelligenceItem, "sourceUrl">>(items: T[]): T[] {
  return items.filter((i) => !isFabricated(i));
}

import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

/**
 * Hacker News search API (Algolia). Free, documented, no key, generous limits.
 * Useful as an early-signal layer: developer-tool and consumer-AI launches
 * surface here before they reach the trade press.
 */
export const hnAdapter: SourceAdapter = {
  kind: "hn",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const res = await fetchWithTimeout(def.url, config.ingestion.perSourceTimeoutMs, {
      headers: { "User-Agent": config.ingestion.userAgent, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { hits?: Record<string, any>[] };
    const fetchedAt = new Date().toISOString();

    return (json.hits ?? []).slice(0, 25).map((h) => {
      const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      const canonical = canonicalUrl(url);
      return {
        key: hash(canonical),
        title: String(h.title ?? h.story_title ?? ""),
        summary: truncate(
          `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`, 420),
        url,
        canonicalUrl: canonical,
        sourceName: def.name,
        sourceType: def.sourceType,
        publishedAt: h.created_at ? new Date(h.created_at).toISOString() : null,
        fetchedAt,
        region: def.region,
        platform: "web",
        categories: def.categories,
        language: "en",
      } satisfies RawItem;
    }).filter((i) => i.title);
  },
};

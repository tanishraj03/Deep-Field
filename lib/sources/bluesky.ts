import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, stripHtml, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

/**
 * Bluesky's public AT Protocol endpoint — no key, no account, no auth header.
 *
 * This is the nearest legitimate read on the conversation that used to sit on
 * X. It is offered publicly at public.api.bsky.app and needs none of the
 * bot-wall defeating that Instagram, Facebook and X now require, which is
 * exactly why it is here and they are not.
 *
 * Note what this is NOT: it carries no engagement figures, so items from here
 * are a community-tier SIGNAL about what is being discussed, never a
 * measurement of how much.
 */
export const blueskyAdapter: SourceAdapter = {
  kind: "bluesky",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const res = await fetchWithTimeout(def.url, config.ingestion.perSourceTimeoutMs, {
      headers: { "User-Agent": config.ingestion.userAgent, Accept: "application/json" },
      cache: "no-store",
      minDelayMs: 500,
    });
    if (res.status === 429) throw new Error("rate limited (429) — backing off until tomorrow");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as {
      topics?: { topic?: string; displayName?: string; description?: string; link?: string }[];
    };
    const fetchedAt = new Date().toISOString();

    const out: RawItem[] = [];
    for (const t of json.topics ?? []) {
      const title = stripHtml(String(t.displayName ?? t.topic ?? "")).trim();
      if (!title) continue;
      const url = t.link ? `https://bsky.app${t.link}` : `https://bsky.app/search?q=${encodeURIComponent(title)}`;
      out.push({
          key: hash(`bsky:${title}`),
          title,
          summary: truncate(
            [stripHtml(String(t.description ?? "")), "Trending topic on Bluesky (no engagement figures published)"]
              .filter(Boolean).join(" · "),
            420,
          ),
          url,
          canonicalUrl: canonicalUrl(url),
          sourceName: def.name,
          sourceType: def.sourceType,
          publishedAt: fetchedAt,
          fetchedAt,
          region: def.region,
          platform: "x",
          categories: def.categories,
          language: "en",
      });
    }
    return out;
  },
};

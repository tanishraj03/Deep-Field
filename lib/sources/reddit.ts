import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, stripHtml, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

/**
 * Reddit's public listing JSON. Free, no key, no auth.
 * We request once per subreddit per run with a descriptive User-Agent, which is
 * what Reddit asks unauthenticated readers to do. A 429 is treated as "this
 * source is unavailable today" — we never retry aggressively around a limit.
 */
export const redditAdapter: SourceAdapter = {
  kind: "reddit",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const res = await fetchWithTimeout(def.url, config.ingestion.perSourceTimeoutMs, {
      headers: { "User-Agent": config.ingestion.userAgent, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 429) throw new Error("rate limited (429) — backing off until tomorrow");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as {
      data?: { children?: { data?: Record<string, any> }[] };
    };
    const fetchedAt = new Date().toISOString();
    const out: RawItem[] = [];

    for (const child of json.data?.children ?? []) {
      const p = child.data;
      if (!p || p.stickied || p.over_18) continue;
      const permalink = `https://www.reddit.com${p.permalink}`;
      const canonical = canonicalUrl(permalink);
      // Upvotes and comment counts are real measured numbers — we keep them as
      // evidence of acceleration rather than inventing a popularity figure.
      const evidence = `${p.ups ?? 0} upvotes · ${p.num_comments ?? 0} comments in r/${p.subreddit}`;
      out.push({
        key: hash(canonical),
        title: stripHtml(String(p.title ?? "")),
        summary: truncate(stripHtml(String(p.selftext ?? "")) || evidence, 420),
        url: permalink,
        canonicalUrl: canonical,
        sourceName: `r/${p.subreddit}`,
        sourceType: def.sourceType,
        publishedAt: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
        fetchedAt,
        region: def.region,
        platform: "reddit",
        categories: def.categories,
        language: "en",
      });
    }
    return out.filter((i) => i.title);
  },
};

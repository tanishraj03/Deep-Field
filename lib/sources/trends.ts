import { config } from "@/lib/config";
import { XMLParser } from "fast-xml-parser";
import { canonicalUrl, fetchWithTimeout, hash, stripHtml, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

/**
 * Google Trends publishes a public daily-trends RSS feed per geography.
 * This is the only place in the app where we have a genuinely measured
 * "this is rising" number, so items from here are labelled PUBLIC WEB SIGNAL
 * rather than "Instagram says this is trending".
 */
export const trendsAdapter: SourceAdapter = {
  kind: "trends",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const res = await fetchWithTimeout(def.url, config.ingestion.perSourceTimeoutMs, {
      headers: { "User-Agent": config.ingestion.userAgent, Accept: "application/xml, text/xml" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const doc = parser.parse(await res.text()) as Record<string, any>;
    const items = doc?.rss?.channel?.item;
    const list: Record<string, any>[] = Array.isArray(items) ? items : items ? [items] : [];
    const fetchedAt = new Date().toISOString();

    return list.slice(0, 20).map((it) => {
      const title = stripHtml(String(it.title ?? ""));
      const traffic = String(it["ht:approx_traffic"] ?? "").trim();

      // ht:news_item repeats, so fast-xml-parser hands back an array whenever a
      // term has more than one story. Reading .["ht:news_item_title"] off that
      // array yielded undefined and the item fell back to <link> — which Google
      // sets to the FEED url on every entry. Every trend therefore shared one
      // canonical URL and the deduplicator collapsed all twenty into a single
      // item. That is why the trend lanes were empty.
      const news = it["ht:news_item"];
      const firstNews = (Array.isArray(news) ? news[0] : news) as Record<string, unknown> | undefined;
      const newsTitle = stripHtml(String(firstNews?.["ht:news_item_title"] ?? ""));
      const newsUrl = String(firstNews?.["ht:news_item_url"] ?? "");

      // Never fall back to it.link: it is the feed URL, identical for every row.
      const url = newsUrl ||
        `https://trends.google.com/trending?geo=${def.region}&q=${encodeURIComponent(title)}`;
      const canonical = canonicalUrl(url);
      const measured = traffic ? `${traffic} searches (Google Trends, measured)` : "rising search interest";
      return {
        key: hash(`trend:${def.id}:${title}`),
        title,
        summary: truncate([measured, newsTitle].filter(Boolean).join(" · "), 420),
        url,
        canonicalUrl: canonical,
        sourceName: def.name,
        sourceType: def.sourceType,
        publishedAt: it.pubDate ? new Date(String(it.pubDate)).toISOString() : fetchedAt,
        fetchedAt,
        region: def.region,
        platform: "google-trends",
        categories: def.categories,
        language: "en",
      } satisfies RawItem;
    }).filter((i) => i.title);
  },
};

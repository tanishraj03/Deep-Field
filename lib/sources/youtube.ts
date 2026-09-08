import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, stripHtml, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

/** ISO-8601 duration (PT1M30S) to seconds. */
function durationSeconds(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (+(d ?? 0)) * 86400 + (+(h ?? 0)) * 3600 + (+(mi ?? 0)) * 60 + (+(s ?? 0));
}

function compact(n: number): string {
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)} crore`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} lakh`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

/**
 * YouTube's most-popular chart for one region, split into short and long form.
 *
 * This is the only source in the app that reports what content is actually
 * performing, with a number attached — view, like and comment counts come from
 * the platform itself, so items from here are FACT rather than inference. That
 * is exactly why it is worth a key: nothing free and keyless publishes ranked
 * view counts, and the alternatives (Invidious, Piped, scraping the watch page)
 * are either bot-walled or off-limits.
 *
 * The key is free — Google Cloud, YouTube Data API v3, no billing account,
 * 10,000 units a day against the ~2 units this spends. With no key set the
 * source disables itself and is reported as unavailable, like any other.
 *
 * def.url carries the shape: youtube://mostPopular?regionCode=IN&form=short
 */
export const youtubeAdapter: SourceAdapter = {
  kind: "youtube",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    if (!config.youtube.apiKey) {
      throw new Error("No YOUTUBE_API_KEY set — top-performing video data is unavailable.");
    }
    const params = new URL(def.url.replace("youtube://", "https://youtube.local/")).searchParams;
    const regionCode = params.get("regionCode") ?? "IN";
    const form = params.get("form") === "long" ? "long" : "short";
    const top = Number(params.get("top") ?? 5);

    // One request, 50 rows, then split locally — cheaper than two chart calls
    // and it keeps both forms ranked against the same snapshot.
    const api = new URL("https://www.googleapis.com/youtube/v3/videos");
    api.searchParams.set("part", "snippet,statistics,contentDetails");
    api.searchParams.set("chart", "mostPopular");
    api.searchParams.set("regionCode", regionCode);
    api.searchParams.set("maxResults", "50");
    api.searchParams.set("key", config.youtube.apiKey);

    const res = await fetchWithTimeout(api.toString(), config.ingestion.perSourceTimeoutMs, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      minDelayMs: 300,
    });
    if (res.status === 403) throw new Error("YouTube API quota exhausted or key rejected (403)");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as {
      items?: {
        id: string;
        snippet: { title: string; channelTitle: string; publishedAt: string; description?: string };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
        contentDetails?: { duration?: string };
      }[];
    };

    const fetchedAt = new Date().toISOString();
    // YouTube treats <= 3 minutes as Shorts-eligible.
    const isShort = (s: number) => s > 0 && s <= 180;

    return (json.items ?? [])
      .filter((v) => {
        const secs = durationSeconds(v.contentDetails?.duration ?? "");
        return form === "short" ? isShort(secs) : !isShort(secs);
      })
      .sort((a, b) => Number(b.statistics?.viewCount ?? 0) - Number(a.statistics?.viewCount ?? 0))
      .slice(0, top)
      .map((v, rank) => {
        const views = Number(v.statistics?.viewCount ?? 0);
        const likes = Number(v.statistics?.likeCount ?? 0);
        const comments = Number(v.statistics?.commentCount ?? 0);
        const secs = durationSeconds(v.contentDetails?.duration ?? "");
        const url = `https://www.youtube.com/watch?v=${v.id}`;
        // Every number here is reported by YouTube. Nothing is estimated.
        const measured =
          `#${rank + 1} by views in ${regionCode} · ${compact(views)} views` +
          `${likes ? ` · ${compact(likes)} likes` : ""}` +
          `${comments ? ` · ${compact(comments)} comments` : ""}` +
          ` · ${Math.floor(secs / 60)}m ${secs % 60}s · ${v.snippet.channelTitle}`;
        return {
          key: hash(`yt:${def.id}:${v.id}`),
          title: stripHtml(v.snippet.title),
          summary: truncate([measured, stripHtml(v.snippet.description ?? "")].filter(Boolean).join(" — "), 420),
          url,
          canonicalUrl: canonicalUrl(url),
          sourceName: def.name,
          sourceType: def.sourceType,
          publishedAt: v.snippet.publishedAt ?? null,
          fetchedAt,
          region: def.region,
          platform: "youtube",
          categories: def.categories,
          language: "en",
        } satisfies RawItem;
      });
  },
};

import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

/**
 * Namespace and housekeeping pages. These dominate the raw top-1000 and are
 * not culture — they are how people navigate the encyclopaedia.
 */
const NAMESPACE_RE =
  /^(Special:|Wikipedia:|Portal:|Category:|File:|Help:|Template:|Talk:|User:|विशेष:|विकिपीडिया:|श्रेणी:|Main_Page|मुखपृष्ठ|-)/i;

/** Kept out of a work brief regardless of how well it performs. */
const NSFW_RE = /(pornograph|sex_position|यौन_आसन|xxx|nude|erotic)/i;

function yesterdayUtc(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}

/**
 * Wikipedia's short descriptions, all titles in one request.
 *
 * The pageviews API returns bare article names, and a bare name carries no
 * signal a relevance filter can read — "ईशा रिखी" is indistinguishable from a
 * politician or a town. The short description ("भारतीय अभिनेत्री और मॉडल")
 * supplies the context that decides whether this is a culture moment. One
 * extra request per wiki, batched, rather than one per article.
 */
async function descriptions(host: string, titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (titles.length === 0) return out;
  const api = new URL(`https://${host}/w/api.php`);
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  api.searchParams.set("prop", "description");
  api.searchParams.set("titles", titles.slice(0, 50).join("|"));
  try {
    const res = await fetchWithTimeout(api.toString(), config.ingestion.perSourceTimeoutMs, {
      headers: { "User-Agent": config.ingestion.userAgent, Accept: "application/json" },
      cache: "no-store",
      minDelayMs: 400,
    });
    if (!res.ok) return out;
    const json = (await res.json()) as { query?: { pages?: { title?: string; description?: string }[] } };
    for (const page of json.query?.pages ?? []) {
      if (page.title && page.description) out.set(page.title, page.description);
    }
  } catch { /* descriptions are a bonus; never fail the source over them */ }
  return out;
}

function compact(n: number): string {
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)} lakh`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

/**
 * Wikimedia's pageviews API: the most-read articles on a given wiki yesterday.
 *
 * This is the closest thing to a free, keyless, unambiguously permitted read of
 * what a country is paying attention to. When a meme or a moment breaks in
 * India, people look the person up — so an actor's page jumping to five figures
 * is a measured culture spike, not an inference. Hindi Wikipedia is a
 * noticeably better read on Indian internet culture than the English one.
 *
 * Documented, rate-limit-friendly, and explicitly offered for public use:
 * https://wikimedia.org/api/rest_v1/
 *
 * def.url shape: wikipedia://top?wiki=hi.wikipedia&top=12
 */
export const wikipediaAdapter: SourceAdapter = {
  kind: "wikipedia",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const params = new URL(def.url.replace("wikipedia://", "https://wiki.local/")).searchParams;
    const wiki = params.get("wiki") ?? "en.wikipedia";
    const top = Number(params.get("top") ?? 12);

    const api = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${wiki}/all-access/${yesterdayUtc()}`;
    const res = await fetchWithTimeout(api, config.ingestion.perSourceTimeoutMs, {
      headers: { "User-Agent": config.ingestion.userAgent, Accept: "application/json" },
      cache: "no-store",
      minDelayMs: 500,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as {
      items?: { articles?: { article: string; views: number; rank: number }[] }[];
    };
    const articles = json.items?.[0]?.articles ?? [];
    const fetchedAt = new Date().toISOString();
    const host = wiki.replace(".wikipedia", ".wikipedia.org");

    const kept = articles
      .filter((a) => !NAMESPACE_RE.test(a.article) && !NSFW_RE.test(a.article))
      .slice(0, top);
    const desc = await descriptions(host, kept.map((a) => decodeURIComponent(a.article).replace(/_/g, " ")));

    return kept
      .map((a) => {
        const readable = decodeURIComponent(a.article).replace(/_/g, " ");
        const url = `https://${host}/wiki/${encodeURIComponent(a.article)}`;
        return {
          key: hash(`wiki:${wiki}:${a.article}:${yesterdayUtc()}`),
          title: readable,
          // Every number here is Wikimedia's own count for yesterday.
          summary: truncate(
            [
              desc.get(readable) ?? "",
              `${compact(a.views)} pageviews yesterday on ${wiki} (Wikimedia, measured) · ranked #${a.rank}`,
            ].filter(Boolean).join(" · "),
            420,
          ),
          url,
          canonicalUrl: canonicalUrl(url),
          sourceName: def.name,
          sourceType: def.sourceType,
          publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          fetchedAt,
          region: def.region,
          platform: "web",
          categories: def.categories,
          language: wiki.startsWith("hi") ? "hi" : "en",
        } satisfies RawItem;
      });
  },
};

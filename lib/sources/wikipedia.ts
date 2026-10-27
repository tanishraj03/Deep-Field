import type { Signal } from "@/lib/types";
import { guessNiche } from "@/lib/niches";
import { hash } from "@/lib/utils";
import { getJson } from "./http";

/**
 * Wikimedia pageviews, free, keyless, explicitly offered for reuse. When a
 * moment breaks, people look it up, so a page jumping to six figures is a
 * measured attention spike. The per-country endpoint is what gives India its
 * own read rather than a slice of the English-language world.
 */

const REST = "https://wikimedia.org/api/rest_v1/metrics/pageviews";
const SKIP = /^(Special:|Wikipedia:|Portal:|Category:|File:|Help:|Template:|Talk:|User:|Main_Page|-|विशेष:|मुखपृष्ठ)/i;
const NSFW = /(pornograph|sex_position|xxx|nude|erotic|xvideos|xhamster|onlyfans)/i;

function ymd(daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { path: `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`, compact: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` };
}

const readable = (a: string) => decodeURIComponent(a).replace(/_/g, " ");

function signal(article: string, views: number, project: string, region: "IN" | "GLOBAL", rank: number): Signal {
  const host = project.includes(".") ? `${project}.org` : `${project}.wikipedia.org`;
  const title = readable(article);
  return {
    id: `wiki:${region}:${hash(article)}`,
    source: "wikipedia",
    title,
    url: `https://${host}/wiki/${encodeURIComponent(article)}`,
    region,
    measure: `${views.toLocaleString("en-US")} views yesterday`,
    value: views,
    niche: guessNiche(title),
    context: `#${rank} most-read${region === "IN" ? " in India" : " on English Wikipedia"}`,
  };
}

/** Yesterday's most-read articles from readers in India, all languages. */
export async function topIndia(limit = 15): Promise<Signal[]> {
  // The per-country table lands a day or two late; try the most recent first.
  for (const back of [1, 2, 3]) {
    try {
      const r = await getJson<{ items?: { articles?: { article: string; project: string; views_ceil: number; rank: number }[] }[] }>(
        `${REST}/top-per-country/IN/all-access/${ymd(back).path}`, { gapMs: 300 });
      const list = (r.items?.[0]?.articles ?? [])
        .filter((a) => !SKIP.test(a.article) && !NSFW.test(a.article) && a.project !== "commons.wikimedia");
      if (list.length) return list.slice(0, limit).map((a, i) => signal(a.article, a.views_ceil, a.project, "IN", i + 1));
    } catch { /* try the day before */ }
  }
  return [];
}

export async function topGlobal(limit = 15): Promise<Signal[]> {
  const r = await getJson<{ items?: { articles?: { article: string; views: number; rank: number }[] }[] }>(
    `${REST}/top/en.wikipedia/all-access/${ymd(1).path}`, { gapMs: 300 });
  return (r.items?.[0]?.articles ?? [])
    .filter((a) => !SKIP.test(a.article) && !NSFW.test(a.article))
    .slice(0, limit)
    .map((a, i) => signal(a.article, a.views, "en.wikipedia", "GLOBAL", i + 1));
}

/** Daily views of the article that best matches a query, last 30 days. */
export async function attention(query: string) {
  const s = await getJson<[string, string[], string[], string[]]>(
    `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=1&namespace=0&search=${encodeURIComponent(query)}`,
    { gapMs: 200 });
  const title = s[1]?.[0];
  if (!title) return null;
  const article = encodeURIComponent(title.replace(/ /g, "_"));
  const r = await getJson<{ items?: { timestamp: string; views: number }[] }>(
    `${REST}/per-article/en.wikipedia/all-access/user/${article}/daily/${ymd(30).compact}/${ymd(1).compact}`,
    { gapMs: 200 });
  return {
    article: title,
    url: `https://en.wikipedia.org/wiki/${article}`,
    daily: (r.items ?? []).map((i) => ({
      date: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
      views: i.views,
    })),
  };
}

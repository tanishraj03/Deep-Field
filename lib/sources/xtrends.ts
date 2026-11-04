import { guessNiche } from "@/lib/niches";
import type { Signal, TrendSize } from "@/lib/types";
import { decodeEntities } from "@/lib/utils";
import { getText } from "./http";
import * as gnews from "./googlenews";
import * as social from "./social";
import * as yt from "./youtube";

/**
 * What is trending on X, read from getdaytrends.com, a public tracker of
 * X's trending list per country. X's own API has no free read access, and
 * scraping X directly breaks its terms; this reads one public page per
 * region, which the site's robots.txt does not restrict.
 *
 * It gives each trend's position, not a post count, so the measure says so.
 */

const PAGES = { IN: "https://getdaytrends.com/india/", GLOBAL: "https://getdaytrends.com/" } as const;

export async function trending(region: "IN" | "GLOBAL", limit = 25): Promise<Signal[]> {
  const page = await getText(PAGES[region], {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; DeepField/2.0; personal research)" },
  });
  // The live list is the "trends" tables (top 15, then the rest collapsed);
  // the "top" tables further down are historical records.
  const tables = [...page.matchAll(/<table class="[^"]*\btrends\b[^"]*"[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1]).join("");
  const names = [...tables.matchAll(/class="main"[^>]*>\s*<a [^>]*>([^<]+)<\/a>/g)].map((m) => decodeEntities(m[1]).trim());
  return [...new Set(names)].slice(0, limit).map((name, i) => ({
    id: `x:${region}:${name.toLowerCase()}`,
    source: "x" as const,
    title: name,
    url: `https://x.com/search?q=${encodeURIComponent(name)}&src=trend_click`,
    region,
    measure: `#${i + 1} trending on X${region === "IN" ? " in India" : " worldwide"}`,
    value: limit - i,
    niche: guessNiche(trendQuery(name)),
  }));
}

/** "#IPLAuction2027" → "IPL Auction 2027": what people would type to mention it. */
export function trendQuery(name: string): string {
  return name.replace(/^#/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

/**
 * How big an X trend is on platforms that publish numbers: Bluesky posts and
 * Google News articles in the last two days, and, when asked (a YouTube
 * search costs 100 of the 10,000 free daily units), the week's most-viewed
 * videos on it. All free. Each platform that fails is left null.
 */
export async function sizeTrend(s: Signal, opts: { youtube: boolean }): Promise<TrendSize> {
  const query = trendQuery(s.title);
  const india = s.region === "IN";
  const twoDaysAgo = Date.now() - 2 * 86_400_000;
  const [bsky, news, videos] = await Promise.all([
    social.blueskyCount(query, 2).catch(() => null),
    gnews.search(query, india)
      .then((items) => items.filter((p) => p.createdAt && Date.parse(p.createdAt) >= twoDaysAgo).length)
      .catch(() => null),
    opts.youtube && yt.hasYouTube() ? yt.search(query, india).catch(() => null) : Promise.resolve(null),
  ]);
  const top = videos?.posts.slice().sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0];
  return {
    query,
    bluesky: bsky?.count ?? null,
    blueskyCapped: bsky?.capped,
    news,
    youtubeViews: videos ? videos.posts.reduce((a, p) => a + (p.views ?? 0), 0) : null,
    youtubeTop: top && top.views ? { title: top.title, url: top.url, views: top.views } : null,
  };
}

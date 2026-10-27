import { guessNiche } from "@/lib/niches";
import type { Signal } from "@/lib/types";
import { decodeEntities } from "@/lib/utils";
import { getText } from "./http";

/**
 * What is trending on X, read from getdaytrends.com — a public tracker of
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
    niche: guessNiche(name.replace(/^#/, "").replace(/([a-z])([A-Z])/g, "$1 $2")),
  }));
}

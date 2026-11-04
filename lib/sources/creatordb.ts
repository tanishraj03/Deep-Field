import type { InstagramAudio } from "@/lib/types";
import { decodeEntities } from "@/lib/utils";
import { getText, SourceError } from "./http";

/**
 * What is trending on Instagram Reels, from CreatorDB's free weekly chart of
 * trending audio. Instagram publishes no trends of its own and Meta's API has
 * no trending feed, so this is the closest free signal: the sounds Reels are
 * being built on this week, with the format behind each and how many Reels
 * use it. CreatorDB's robots.txt welcomes all crawlers; the chart is read
 * once per signals scan and credited with a link back.
 *
 * It is a global (mostly US) chart, updated weekly, and covers audio only,
 * not hashtags or topics.
 */

export const CHART_URL = "https://creatordb.app/free-tools/trending-instagram-audio/";

const text = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const cell = (row: string, cls: string) => row.match(new RegExp(`<td[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>([\\s\\S]*?)</td>`))?.[1] ?? "";

export async function trendingAudio(): Promise<{ week: string | null; url: string; items: InstagramAudio[] }> {
  const page = await getText(CHART_URL, {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; DeepField/2.0; content research)" },
  });
  const start = page.indexOf("Reels</th>");
  if (start < 0) throw new SourceError("CreatorDB: chart not found on the page");
  const rows = [...page.slice(start).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);

  const items: InstagramAudio[] = [];
  for (const row of rows) {
    const song = row.match(/class="song-cell"[\s\S]*?<b>([\s\S]*?)<\/b>\s*<span>([\s\S]*?)<\/span>/);
    if (!song) continue;
    const rank = Number(text(cell(row, "rk")));
    const heat = Number(text(row.match(/class="heatnum">([^<]*)</)?.[1] ?? ""));
    const reels = text(cell(row, "reels-val"));
    items.push({
      rank: Number.isFinite(rank) && rank > 0 ? rank : items.length + 1,
      song: text(song[1]),
      artist: text(song[2]),
      trend: text(cell(row, "trend-cell")),
      heat: Number.isFinite(heat) && heat > 0 ? heat : null,
      momentum: text(row.match(/class="chip[^"]*">([^<]*)</)?.[1] ?? "") || null,
      reels: /\d/.test(reels) ? reels : null,
      charts: [...cell(row, "charts-cell").matchAll(/<span class="pill">([^<]*)<\/span>/g)].map((m) => decodeEntities(m[1]).trim()),
    });
  }
  if (!items.length) throw new SourceError("CreatorDB: chart was empty");
  const week = page.match(/Week of ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1] ?? null;
  return { week, url: CHART_URL, items };
}

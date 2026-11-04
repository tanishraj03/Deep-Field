import type { IndiaSong } from "@/lib/types";
import { decodeEntities } from "@/lib/utils";
import { getText, SourceError } from "./http";

/**
 * The songs Indian Reels are being built on: Spotify India's daily chart,
 * read from kworb.net's public mirror (its robots.txt allows everyone).
 * Instagram publishes no trending-audio chart for India, and no free source
 * tracks one; the India lists that exist are themselves built from this
 * chart, so DeepField reads it directly and says so.
 */

export const INDIA_URL = "https://kworb.net/spotify/country/in_daily.html";

const text = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const LANGS = /\[(Hindi|Tamil|Telugu|Kannada|Malayalam|Punjabi|Bengali|Marathi|Gujarati|Bhojpuri|Haryanvi)\]/i;

export async function spotifyIndia(limit = 15): Promise<{ date: string | null; url: string; items: IndiaSong[] }> {
  const page = await getText(INDIA_URL, {
    headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; DeepField/2.0; content research)" },
  });
  const rows = [...page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const items: IndiaSong[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const rank = Number(text(cells[0]));
    if (!Number.isFinite(rank) || rank < 1) continue;
    // "Artist - Title (w/ Feature)", artist and track each linked.
    const cell = cells[2];
    const artist = text(cell.match(/<a [^>]*artist[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
    const trackId = cell.match(/track\/([A-Za-z0-9]+)\.html/)?.[1];
    const title = text(cell.match(/<a [^>]*track[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "");
    if (!title) continue;
    const full = text(cell);
    const move = text(cells[1]);
    items.push({
      rank,
      song: title.replace(LANGS, "").trim(),
      artist: artist || full.split(" - ")[0],
      language: full.match(LANGS)?.[1] ?? null,
      /** "=" holding, "+2" up, "-1" down, "NEW" or "RE" for a (re-)entry. */
      move: move === "=" || !move ? null : move,
      days: Number(text(cells[3])) || null,
      peak: Number(text(cells[4])) || null,
      url: trackId ? `https://open.spotify.com/track/${trackId}` : INDIA_URL,
    });
    if (items.length >= limit) break;
  }
  if (!items.length) throw new SourceError("kworb: Spotify India chart was empty");
  const date = page.match(/(\d{4}\/\d{2}\/\d{2})/)?.[1]?.replace(/\//g, "-") ?? null;
  return { date, url: INDIA_URL, items };
}

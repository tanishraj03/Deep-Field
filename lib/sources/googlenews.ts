import { XMLParser } from "fast-xml-parser";
import { guessNiche } from "@/lib/niches";
import type { Post, Signal } from "@/lib/types";
import { decodeEntities, hash, stripHtml } from "@/lib/utils";
import { getText } from "./http";

/**
 * Google News, through its public RSS feeds. Keyless and quick, with editions
 * for India and the US. Each top story lists the other outlets covering it,
 * which is a fair measure of how big a news story is. Search returns up to
 * 100 recent articles for any query, a floor, not a total.
 */

// Entities are left alone: a front page can carry more than the parser's
// expansion limit, and stripHtml decodes them anyway.
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false });
const edition = (india: boolean) => (india ? "hl=en-IN&gl=IN&ceid=IN:en" : "hl=en-US&gl=US&ceid=US:en");

interface Item { title?: string; link?: string; pubDate?: string; description?: string; source?: { "#text"?: string } | string }

async function feed(url: string): Promise<Item[]> {
  const doc = parser.parse(await getText(url)) as { rss?: { channel?: { item?: Item | Item[] } } };
  const items = doc.rss?.channel?.item;
  return items ? (Array.isArray(items) ? items : [items]) : [];
}

/** "Headline - Publisher" → the headline alone; the publisher comes from <source>. */
function split(item: Item): { title: string; publisher: string } {
  const publisher = stripHtml(typeof item.source === "string" ? item.source : item.source?.["#text"] ?? "");
  const raw = stripHtml(String(item.title ?? ""));
  const title = publisher && raw.endsWith(` - ${publisher}`) ? raw.slice(0, -publisher.length - 3) : raw;
  return { title, publisher };
}

const toIso = (d?: string) => (d && !Number.isNaN(Date.parse(d)) ? new Date(d).toISOString() : null);

/** Articles about a query from the past week, newest Google ranks first. */
export async function search(query: string, india: boolean): Promise<Post[]> {
  const items = await feed(`https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:7d`)}&${edition(india)}`);
  return items.map((it) => {
    const { title, publisher } = split(it);
    return {
      id: `gn:${hash(String(it.link ?? title))}`,
      source: "news" as const,
      title,
      url: decodeEntities(String(it.link ?? "")),
      community: publisher || "News",
      region: india ? "IN" as const : "GLOBAL" as const,
      createdAt: toIso(it.pubDate),
      measured: true,
    };
  }).filter((p) => p.title && p.url);
}

/** Today's top stories in an edition, sized by how many outlets cover each. */
export async function topStories(region: "IN" | "US"): Promise<Signal[]> {
  const items = await feed(`https://news.google.com/rss?${edition(region === "IN")}`);
  return items.map((it, i) => {
    const { title, publisher } = split(it);
    const outlets = (String(it.description ?? "").match(/<li>|&lt;li&gt;/gi) ?? []).length || 1;
    return {
      id: `gnews:${region}:${hash(title)}`,
      source: "news" as const,
      title,
      url: decodeEntities(String(it.link ?? "")),
      region: region === "IN" ? "IN" as const : "GLOBAL" as const,
      measure: outlets > 1 ? `covered by ${outlets}+ outlets` : `top story #${i + 1}`,
      // Rank matters as much as outlet count: Google orders the front page.
      value: outlets * 10 + Math.max(0, 40 - i),
      niche: guessNiche(title),
      context: publisher || undefined,
    };
  }).filter((s) => s.title && s.url);
}

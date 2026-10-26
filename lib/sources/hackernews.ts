import type { Post } from "@/lib/types";
import { getJson } from "./http";

/** Hacker News via Algolia. Free, keyless, generous, and every count is real. */

interface Hit {
  objectID: string; title?: string; url?: string; points?: number;
  num_comments?: number; created_at_i: number; story_text?: string;
}
interface Res { hits: Hit[]; nbHits: number }

const BASE = "https://hn.algolia.com/api/v1";

function toPost(h: Hit): Post {
  return {
    id: `hn:${h.objectID}`,
    source: "hackernews",
    title: h.title ?? "",
    url: `https://news.ycombinator.com/item?id=${h.objectID}`,
    community: "Hacker News",
    region: "GLOBAL",
    createdAt: new Date(h.created_at_i * 1000).toISOString(),
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    measured: true,
  };
}

export async function frontPage(): Promise<Post[]> {
  const r = await getJson<Res>(`${BASE}/search?tags=front_page&hitsPerPage=40`);
  return r.hits.filter((h) => h.title).map(toPost);
}

export interface HnSearch { week: number; posts: Post[]; daily: Map<string, number> }

export async function search(query: string): Promise<HnSearch> {
  const since = (d: number) => Math.floor(Date.now() / 1000) - d * 86400;
  // Titles only, no typo tolerance: otherwise "ozempic" matches an unrelated
  // Show HN through a fuzzy hit in its body text.
  const q = `${encodeURIComponent(query)}&restrictSearchableAttributes=title&typoTolerance=false`;
  const [top, recent] = await Promise.all([
    getJson<Res>(`${BASE}/search?query=${q}&tags=story&hitsPerPage=20&numericFilters=created_at_i>${since(7)}`),
    getJson<Res>(`${BASE}/search_by_date?query=${q}&tags=story&hitsPerPage=300&numericFilters=created_at_i>${since(14)}`),
  ]);
  const daily = new Map<string, number>();
  for (const h of recent.hits) {
    const d = new Date(h.created_at_i * 1000).toISOString().slice(0, 10);
    daily.set(d, (daily.get(d) ?? 0) + 1);
  }
  return { week: top.nbHits, posts: top.hits.filter((h) => h.title).map(toPost), daily };
}

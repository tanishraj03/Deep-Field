import type { Comment, Post } from "@/lib/types";
import { stripHtml, truncate } from "@/lib/utils";
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

/* ───────────── Top comments ───────────── */

interface Item { id: number; author: string | null; text: string | null; created_at_i: number; children: Item[] }

/** HN comment HTML to text, keeping paragraph breaks. */
const toText = (html: string) => html.split(/<p>/i).map(stripHtml).filter(Boolean).join("\n\n");

function descendants(i: Item): number {
  return i.children.reduce((a, c) => a + 1 + descendants(c), 0);
}

function toComment(i: Item, post: Post, depth: number, parentId?: string): Comment {
  const id = `hnc:${i.id}`;
  const kids = i.children.filter((c) => c.text && c.author);
  return {
    id,
    source: "hackernews",
    postId: post.id,
    author: i.author ?? "",
    text: truncate(toText(i.text ?? ""), 900),
    url: `https://news.ycombinator.com/item?id=${i.id}`,
    createdAt: new Date(i.created_at_i * 1000).toISOString(),
    // HN publishes no comment points; the size of the sub-thread is its signal.
    replyCount: descendants(i),
    parentId,
    replies: depth > 0
      ? kids.sort((a, b) => descendants(b) - descendants(a)).slice(0, 3).map((k) => toComment(k, post, depth - 1, id))
      : [],
  };
}

/** The comments that drew the most discussion under one story. */
export async function storyComments(post: Post, max = 20): Promise<Comment[]> {
  const item = await getJson<Item>(`${BASE}/items/${post.id.replace(/^hn:/, "")}`);
  return item.children
    .filter((c) => c.text && c.author)
    .map((c) => toComment(c, post, 1))
    .sort((a, b) => (b.replyCount ?? 0) - (a.replyCount ?? 0))
    .slice(0, max);
}

/** Stories and comments mentioning a query in the last `days`, every one Algolia indexes. */
export async function mentions(query: string, days = 7): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const r = await getJson<Res>(`${BASE}/search?query=${encodeURIComponent(query)}&tags=${encodeURIComponent("(story,comment)")}&numericFilters=${encodeURIComponent(`created_at_i>${since}`)}&hitsPerPage=1&typoTolerance=false`);
  return r.nbHits;
}

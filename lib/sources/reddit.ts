import { XMLParser } from "fast-xml-parser";
import { config } from "@/lib/config";
import { isIndianCommunity, type RegionCode } from "@/lib/niches";
import type { Comment, Post } from "@/lib/types";
import { pool, stripHtml, truncate } from "@/lib/utils";
import * as arctic from "./arctic";
import type { RedditNode } from "./arctic";
import { get, SourceError } from "./http";

/**
 * Reddit, read three ways in order of preference:
 *
 *  1. Reddit's own API, when REDDIT_CLIENT_ID/SECRET are set, live counts.
 *  2. The Arctic Shift archive, keyless and reliable; counts settle at ~36h.
 *  3. Reddit's public RSS, Reddit's own ranking and sitewide search, but no
 *     counts, and it rate-limits quickly. Used where ranking is the point.
 */

const RSS_GAP_MS = 2500;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", processEntities: false });

function decode(s: string): string {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|#39));/gi, (_m, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" } as Record<string, string>)[String(name).toLowerCase()] ?? " ";
  });
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

export const regionOf = (sub: string): RegionCode => (isIndianCommunity(sub) ? "IN" : "GLOBAL");

function postUrl(sub: string, id: string) {
  return `https://www.reddit.com/r/${sub}/comments/${id}/`;
}

function fromArctic(p: arctic.ArcticPost, regionHint?: RegionCode): Post {
  const measured = arctic.isMeasured(p.created_utc);
  return {
    id: `rd:${p.id}`,
    source: "reddit",
    title: stripHtml(decode(p.title ?? "")),
    url: postUrl(p.subreddit, p.id),
    community: `r/${p.subreddit}`,
    region: regionHint ?? regionOf(p.subreddit),
    createdAt: new Date(p.created_utc * 1000).toISOString(),
    score: measured ? p.score : undefined,
    comments: measured ? p.num_comments : undefined,
    measured,
    snippet: p.selftext && !/^\[(removed|deleted)\]$/.test(p.selftext)
      ? truncate(stripHtml(decode(p.selftext)), 220) : undefined,
  };
}

/* ───────────── Reddit OAuth (optional) ───────────── */

let token: { value: string; expires: number } | null = null;

export const hasRedditApi = () => Boolean(config.reddit.clientId && config.reddit.clientSecret);

async function oauthToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${config.reddit.clientId}:${config.reddit.clientSecret}`).toString("base64");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": config.reddit.userAgent,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new SourceError(`Reddit API auth failed (HTTP ${res.status})`, res.status);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return token.value;
}

interface ListingChild {
  data: {
    id: string; title: string; subreddit: string; score: number; num_comments: number;
    created_utc: number; selftext?: string; over_18?: boolean; stickied?: boolean;
  };
}

async function oauthListing(path: string): Promise<ListingChild["data"][]> {
  const res = await get(`https://oauth.reddit.com${path}`, {
    headers: { Authorization: `Bearer ${await oauthToken()}`, "User-Agent": config.reddit.userAgent },
    gapMs: 700,
  });
  if (res.status === 429) throw new SourceError("Reddit API rate limited", 429);
  if (!res.ok) throw new SourceError(`Reddit API HTTP ${res.status}`, res.status);
  const json = (await res.json()) as { data?: { children?: ListingChild[] } };
  return (json.data?.children ?? []).map((c) => c.data).filter((d) => !d.over_18 && !d.stickied);
}

function fromListing(d: ListingChild["data"], rank?: number): Post {
  return {
    id: `rd:${d.id}`,
    source: "reddit",
    title: stripHtml(decode(d.title)),
    url: postUrl(d.subreddit, d.id),
    community: `r/${d.subreddit}`,
    region: regionOf(d.subreddit),
    createdAt: new Date(d.created_utc * 1000).toISOString(),
    score: d.score,
    comments: d.num_comments,
    measured: true,
    hotRank: rank,
    snippet: d.selftext ? truncate(stripHtml(decode(d.selftext)), 220) : undefined,
  };
}

/* ───────────── RSS ───────────── */

interface RssEntry { id: string; title: string; sub: string; createdAt: string | null; body: string }

/** After a 429, RSS is left alone for a while instead of being asked again per niche. */
let rssBlockedUntil = 0;

async function rss(url: string): Promise<RssEntry[]> {
  if (Date.now() < rssBlockedUntil) throw new SourceError("Reddit RSS rate limited (cooling down)", 429);
  const res = await get(url, {
    headers: { Accept: "application/atom+xml, application/xml;q=0.9" },
    gapMs: RSS_GAP_MS,
  });
  if (res.status === 429) {
    rssBlockedUntil = Date.now() + 10 * 60_000;
    throw new SourceError("Reddit RSS rate limited", 429);
  }
  if (!res.ok) throw new SourceError(`Reddit RSS HTTP ${res.status}`, res.status);
  const doc = parser.parse(await res.text()) as { feed?: { entry?: unknown } };
  return asArray(doc.feed?.entry as Record<string, any> | Record<string, any>[]).map((e) => {
    const link = String(e.link?.["@_href"] ?? "");
    const m = link.match(/\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
    return {
      id: m?.[2] ?? "",
      sub: m?.[1] ?? String(e.category?.["@_term"] ?? ""),
      title: stripHtml(decode(String(e.title ?? ""))),
      createdAt: e.published ? new Date(String(e.published)).toISOString() : null,
      body: stripHtml(decode(String(e.content?.["#text"] ?? e.content ?? "")))
        .replace(/submitted by\s*\/u\/\S+/i, "").replace(/\[(link|comments)\]/gi, "").trim(),
    };
  }).filter((e) => e.id && e.title);
}

/* ───────────── Niche scan ───────────── */

export interface CommunityRead {
  posts: Post[];
  /** Every post fetched, before keeping the strongest, the scan's reach. */
  read: number;
  /** Posts in the last 24h, from the full fetch, not just those kept. */
  fresh24h: number;
  via: "reddit-api" | "archive";
}

/**
 * Recent conversations in one community.
 * Archive path: newest posts (volume, unmeasured) plus the newest posts past
 * the ~36h mark (measured), each capped at 100 by the service.
 */
export async function readCommunity(sub: string, region: RegionCode, tier: "core" | "tail" = "core"): Promise<CommunityRead> {
  const dayAgo = Date.now() - 86_400_000;
  if (tier === "tail" && !hasRedditApi()) {
    // One request: the newest 100 posts old enough to have real counts. For
    // most smaller communities that is their whole week.
    const mature = await arctic.searchPosts({ subreddit: sub, after: "8d", before: "36h", limit: 100 });
    const posts = mature.map((p) => fromArctic(p, region)).sort((a, b) => engagement(b) - engagement(a));
    return {
      posts: posts.filter((p) => (p.comments ?? 0) + (p.score ?? 0) > 2).slice(0, 20),
      read: mature.length,
      fresh24h: 0,
      via: "archive",
    };
  }
  if (hasRedditApi()) {
    const hot = await oauthListing(`/r/${sub}/hot?limit=100&raw_json=1`);
    const posts = hot.map((d, i) => ({ ...fromListing(d, i + 1), region }));
    return {
      posts,
      read: hot.length,
      fresh24h: hot.filter((d) => d.created_utc * 1000 >= dayAgo).length,
      via: "reddit-api",
    };
  }

  // The archive returns at most 100 posts per request, so the measured week
  // is read in two slices; a busy community fills both.
  const [fresh, recent, older] = await Promise.all([
    arctic.searchPosts({ subreddit: sub, after: "36h", limit: 100 }),
    arctic.searchPosts({ subreddit: sub, after: "4d", before: "36h", limit: 100 }),
    arctic.searchPosts({ subreddit: sub, after: "8d", before: "4d", limit: 100 }).catch(() => [] as arctic.ArcticPost[]),
  ]);
  const freshPosts = fresh.map((p) => fromArctic(p, region));
  const maturePosts = [...recent, ...older]
    .map((p) => fromArctic(p, region))
    .sort((a, b) => engagement(b) - engagement(a));

  return {
    // Every measured post that drew real discussion, plus the newest fresh
    // ones, fresh posts are how a conversation that started this morning
    // shows up at all.
    posts: [...maturePosts.filter((p) => (p.comments ?? 0) + (p.score ?? 0) > 2).slice(0, 80), ...freshPosts.slice(0, 40)],
    read: fresh.length + recent.length + older.length,
    fresh24h: fresh.filter((p) => p.created_utc * 1000 >= dayAgo).length,
    via: "archive",
  };
}

/**
 * Reddit's own "hot" ordering for a set of communities, in one request.
 * Best-effort: it is the only live read of what is taking off right now when
 * there is no API key, and when Reddit rate-limits it we simply go without.
 */
export async function hotRanks(subs: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!subs.length) return out;
  const entries = await rss(`https://www.reddit.com/r/${subs.join("+")}/hot/.rss?limit=100`);
  entries.forEach((e, i) => out.set(`rd:${e.id}`, i + 1));
  return out;
}

export function engagement(p: Post): number {
  return (p.comments ?? 0) * 1 + (p.score ?? 0) * 0.25 + (p.views ?? 0) / 2000;
}

/* ───────────── Explore ───────────── */

export interface RedditSearch {
  posts: Post[];
  via: "reddit-api" | "rss" | "archive";
  note?: string;
}

/**
 * Sitewide search for the past week. RSS search returns Reddit's ranking
 * without numbers, so the results are then looked up in the archive by id,
 * which fills in real counts for every post old enough to have them.
 */
export async function searchReddit(
  query: string,
  opts: { within?: string[]; fallbackSubs: string[] },
): Promise<RedditSearch> {
  const q = encodeURIComponent(query);
  // Restricting to a set of communities is one request either way: Reddit
  // accepts r/a+b+c as a single multi-community path.
  const scope = opts.within?.length ? `/r/${opts.within.join("+")}` : "";
  const restrict = scope ? "&restrict_sr=on" : "";
  const fallbackSubs = opts.fallbackSubs;

  if (hasRedditApi()) {
    const hits = await oauthListing(`${scope}/search?q=${q}${restrict}&sort=relevance&t=week&limit=100&raw_json=1`);
    return { posts: hits.map((d, i) => fromListing(d, i + 1)), via: "reddit-api" };
  }

  try {
    const entries = await rss(
      `https://www.reddit.com${scope}/search.rss?q=${q}${restrict}&sort=relevance&t=week&limit=100`,
    );
    const known = new Map((await arctic.postsById(entries.map((e) => e.id)).catch(() => [])).map((p) => [p.id, p]));
    const posts = entries.map((e, i): Post => {
      const a = known.get(e.id);
      if (a) return { ...fromArctic(a), hotRank: i + 1 };
      return {
        id: `rd:${e.id}`, source: "reddit", title: e.title, url: postUrl(e.sub, e.id),
        community: `r/${e.sub}`, region: regionOf(e.sub), createdAt: e.createdAt,
        measured: false, hotRank: i + 1, snippet: e.body ? truncate(e.body, 220) : undefined,
      };
    });
    return { posts, via: "rss" };
  } catch {
    // Reddit refused the search. The archive cannot search all of Reddit, and
    // its keyword search inside a community mostly answers "slow down", so
    // read each candidate community's week instead (newest posts, plus older
    // ones with settled counts) and keep the posts that name every search
    // word. Reliable and paced by the archive limiter; narrower, and says so.
    const subs = fallbackSubs.slice(0, 30);
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const names = (p: Post) => { const t = `${p.title} ${p.snippet ?? ""}`.toLowerCase(); return words.every((w) => t.includes(w)); };
    const results = await pool(subs, 8, async (s) => {
      const [fresh, mature] = await Promise.all([
        arctic.searchPosts({ subreddit: s, after: "7d", limit: 100 }).catch(() => [] as arctic.ArcticPost[]),
        arctic.searchPosts({ subreddit: s, after: "7d", before: "36h", limit: 100 }).catch(() => [] as arctic.ArcticPost[]),
      ]);
      return [...fresh, ...mature];
    });
    const seen = new Set<string>();
    const posts = results.flat().map((p) => fromArctic(p)).filter((p) => names(p) && !seen.has(p.id) && seen.add(p.id));
    return {
      posts,
      via: "archive",
      note: `Reddit's search was rate limited, so the past week of ${subs.length} related communities was read and matched instead.`,
    };
  }
}

/* ───────────── Thread reader (assistant) ───────────── */

export interface Thread {
  title: string;
  community: string;
  url: string;
  body: string;
  score?: number;
  comments?: number;
  replies: { text: string; score?: number }[];
}

export function parseThreadId(input: string): string | null {
  const m = input.match(/comments\/([a-z0-9]+)/i) ?? input.match(/^(?:rd:|t3_)?([a-z0-9]{5,10})$/i);
  return m?.[1] ?? null;
}

export async function readThread(input: string): Promise<Thread> {
  const id = parseThreadId(input);
  if (!id) throw new SourceError("Not a Reddit thread link or id");
  const [post] = await arctic.postsById([id]);

  let replies: { text: string; score?: number }[] = [];
  try {
    const entries = await rss(`https://www.reddit.com/comments/${id}/.rss?limit=60&sort=top`);
    replies = entries.slice(1).map((e) => ({ text: truncate(e.body, 400) })).filter((r) => r.text);
  } catch {
    const comments = await arctic.threadComments(id, 80).catch(() => []);
    replies = comments
      .filter((c) => c.body && !/^\[(removed|deleted)\]$/.test(c.body))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((c) => ({ text: truncate(stripHtml(decode(c.body)), 400), score: c.score }));
  }

  if (!post && !replies.length) throw new SourceError("Thread not found");
  return {
    title: post ? stripHtml(decode(post.title)) : "(title unavailable)",
    community: post ? `r/${post.subreddit}` : "",
    url: post ? postUrl(post.subreddit, id) : `https://www.reddit.com/comments/${id}/`,
    body: post?.selftext ? truncate(stripHtml(decode(post.selftext)), 1500) : "",
    score: post && arctic.isMeasured(post.created_utc) ? post.score : undefined,
    comments: post && arctic.isMeasured(post.created_utc) ? post.num_comments : undefined,
    replies,
  };
}

/* ───────────── Top comments ───────────── */

const GONE = /^\[(removed|deleted)\]$/;
const BOTS = new Set(["AutoModerator", "[deleted]"]);

/** Reddit markdown to readable text: links keep their words, emphasis marks go. */
export function cleanMarkdown(s: string): string {
  return decode(s)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|\^)/g, "")
    .replace(/&#x200B;/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toComments(nodes: RedditNode[], post: Post, opts: { archive: boolean; depth: number }): Comment[] {
  const out: Comment[] = [];
  for (const n of nodes) {
    if (n.kind !== "t1") continue;
    const d = n.data;
    if (!d.body || GONE.test(d.body) || BOTS.has(d.author ?? "") || d.stickied) continue;
    const kids = d.replies && typeof d.replies === "object" ? d.replies.data?.children ?? [] : [];
    const replyCount = kids.reduce((a, k) => a + (k.kind === "t1" ? 1 : k.data.count ?? 0), 0);
    // Archive scores settle on the same ~36h clock as posts.
    const measured = !opts.archive || arctic.isMeasured(d.created_utc ?? 0);
    out.push({
      id: `rdc:${d.id}`,
      source: "reddit",
      postId: post.id,
      author: d.author ?? "",
      text: truncate(cleanMarkdown(d.body), 900),
      url: `${post.url}comment/${d.id}/`,
      createdAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      score: measured ? d.score : undefined,
      replyCount,
      replies: opts.depth > 0 ? toComments(kids, post, { ...opts, depth: opts.depth - 1 }).slice(0, 3) : [],
    });
  }
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.replyCount ?? 0) - (a.replyCount ?? 0));
}

/** The most-upvoted comments in a thread, each with its best replies. */
export async function threadComments(post: Post, max = 20): Promise<Comment[]> {
  const id = post.id.replace(/^rd:/, "");
  let nodes: RedditNode[];
  if (hasRedditApi()) {
    const res = await get(`https://oauth.reddit.com/comments/${id}?sort=top&limit=60&depth=2&raw_json=1`, {
      headers: { Authorization: `Bearer ${await oauthToken()}`, "User-Agent": config.reddit.userAgent },
      gapMs: 700,
    });
    if (!res.ok) throw new SourceError(`Reddit API HTTP ${res.status}`, res.status);
    const json = (await res.json()) as { data?: { children?: RedditNode[] } }[];
    nodes = json[1]?.data?.children ?? [];
  } else {
    nodes = await arctic.commentTree(id, 120);
  }
  const top = toComments(nodes, post, { archive: !hasRedditApi(), depth: 1 }).slice(0, max);
  // Replies point at their parent, so a picked reply can show what it answers.
  for (const c of top) for (const r of c.replies) r.parentId = c.id;
  return top;
}

import { guessNiche } from "@/lib/niches";
import type { Comment, Post, Signal } from "@/lib/types";
import { hash, stripHtml, truncate } from "@/lib/utils";
import { getJson } from "./http";

/**
 * The open social web: Bluesky's public trending topics and Mastodon's
 * trending hashtags. Both are keyless. X, Instagram and TikTok publish no
 * equivalent without paid access, so they are not read at all rather than
 * scraped.
 */

export async function blueskyTrending(): Promise<Signal[]> {
  const r = await getJson<{ topics?: { topic?: string; displayName?: string; description?: string; link?: string }[] }>(
    "https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics?limit=20");
  return (r.topics ?? []).map((t, i) => {
    const title = stripHtml(String(t.displayName ?? t.topic ?? "")).trim();
    return {
      id: `bsky:${hash(title)}`,
      source: "bluesky" as const,
      title,
      url: t.link ? `https://bsky.app${t.link}` : `https://bsky.app/search?q=${encodeURIComponent(title)}`,
      region: "GLOBAL" as const,
      measure: `#${i + 1} trending on Bluesky`,
      value: 20 - i,
      niche: guessNiche(`${title} ${t.description ?? ""}`),
      context: t.description ? stripHtml(t.description) : undefined,
    };
  }).filter((s) => s.title);
}

interface Tag { name: string; url: string; history: { day: string; uses: string; accounts: string }[] }

export async function mastodonTrending(): Promise<Signal[]> {
  const tags = await getJson<Tag[]>("https://mastodon.social/api/v1/trends/tags?limit=20");
  return tags.map((t) => {
    const uses = Number(t.history?.[0]?.uses ?? 0);
    const accounts = Number(t.history?.[0]?.accounts ?? 0);
    return {
      id: `masto:${t.name.toLowerCase()}`,
      source: "mastodon" as const,
      title: `#${t.name}`,
      url: t.url,
      region: "GLOBAL" as const,
      measure: `${uses.toLocaleString("en-US")} posts by ${accounts.toLocaleString("en-US")} people today`,
      value: uses,
      niche: guessNiche(t.name),
    };
  });
}

interface BskyPost {
  uri: string;
  author: { handle: string; displayName?: string };
  record: { text?: string; createdAt?: string };
  likeCount?: number; replyCount?: number; repostCount?: number;
}

/**
 * The most-liked Bluesky posts about a topic from the past week. Keyless
 * through api.bsky.app; the "public." host answers 403 to search.
 */
export async function blueskyPosts(query: string, limit = 25): Promise<Comment[]> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const r = await getJson<{ posts?: BskyPost[] }>(
    `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&sort=top&limit=${limit}&since=${since}`);
  return (r.posts ?? [])
    .filter((p) => (p.record.text ?? "").trim().length > 20)
    .map((p) => ({
      id: `bskyp:${p.uri.split("/").pop()}`,
      source: "bluesky" as const,
      postId: `bluesky:${query}`,
      author: p.author.displayName || p.author.handle,
      text: truncate(p.record.text!.trim(), 900),
      url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`,
      createdAt: p.record.createdAt ?? null,
      score: p.likeCount,
      replyCount: p.replyCount,
      replies: [],
    }));
}

/** The news links Mastodon users are sharing most today. */
export async function mastodonLinks(): Promise<Signal[]> {
  const links = await getJson<{ title: string; url: string; provider_name?: string; description?: string; history: { uses: string; accounts: string }[] }[]>(
    "https://mastodon.social/api/v1/trends/links?limit=20");
  return links.map((l) => {
    const accounts = Number(l.history?.[0]?.accounts ?? 0);
    return {
      id: `masto-link:${hash(l.url)}`,
      source: "mastodon" as const,
      title: stripHtml(l.title),
      url: l.url,
      region: "GLOBAL" as const,
      measure: `shared by ${accounts.toLocaleString("en-US")} people today`,
      value: accounts,
      niche: guessNiche(`${l.title} ${l.description ?? ""}`),
      context: l.provider_name || undefined,
    };
  }).filter((s) => s.title);
}

interface BskyHit extends BskyPost { record: { text?: string; createdAt?: string } }

/**
 * Bluesky search as a source: the week's most-liked posts about a query and
 * how many posts match. Bluesky caps its count at 10,000, so that is a floor.
 */
export async function blueskySearch(query: string): Promise<{ total: number; capped: boolean; posts: Post[] }> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const r = await getJson<{ posts?: BskyHit[]; hitsTotal?: number }>(
    `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&sort=top&limit=25&since=${since}`);
  const total = r.hitsTotal ?? (r.posts ?? []).length;
  return {
    total,
    capped: total >= 10_000,
    posts: (r.posts ?? []).filter((p) => (p.record.text ?? "").trim().length > 20).map((p) => {
      const rkey = p.uri.split("/").pop();
      return {
        id: `bsky:${rkey}`,
        source: "bluesky" as const,
        title: truncate(p.record.text!.replace(/\s+/g, " ").trim(), 160),
        url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
        community: `@${p.author.handle}`,
        region: "GLOBAL" as const,
        createdAt: p.record.createdAt ?? null,
        score: p.likeCount,
        comments: p.replyCount,
        measured: true,
      };
    }),
  };
}

interface LemmyPost {
  post: { id: number; name: string; ap_id: string; published: string; body?: string };
  community: { name: string; actor_id: string };
  counts: { comments: number; score: number };
}

/**
 * Lemmy, the open, federated Reddit alternative, through lemmy.world's public
 * API. Smaller than Reddit, but every count is real and nothing needs a key.
 */
export async function lemmySearch(query: string): Promise<Post[]> {
  const r = await getJson<{ posts?: LemmyPost[] }>(
    `https://lemmy.world/api/v3/search?q=${encodeURIComponent(query)}&type_=Posts&sort=TopWeek&limit=25`);
  return (r.posts ?? []).map((p) => ({
    id: `lemmy:${p.post.id}`,
    source: "lemmy" as const,
    title: stripHtml(p.post.name),
    url: p.post.ap_id,
    community: `!${p.community.name}@${new URL(p.community.actor_id).host}`,
    region: "GLOBAL" as const,
    createdAt: p.post.published.endsWith("Z") ? p.post.published : `${p.post.published}Z`,
    score: p.counts.score,
    comments: p.counts.comments,
    measured: true,
    snippet: p.post.body ? truncate(stripHtml(p.post.body), 200) : undefined,
  }));
}

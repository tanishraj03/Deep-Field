import { currentKeys } from "@/lib/keys";
import type { RegionCode } from "@/lib/niches";
import type { Comment, Post } from "@/lib/types";
import { stripHtml, truncate } from "@/lib/utils";
import { get, SourceError } from "./http";

/**
 * YouTube Data API v3. Free key, 10,000 units a day.
 * mostPopular costs 1 unit; a search costs 100. Every number is YouTube's.
 */

const API = "https://www.googleapis.com/youtube/v3";

export const hasYouTube = () => Boolean(currentKeys().youtube);

interface Video {
  id: string;
  snippet: { title: string; channelTitle: string; channelId?: string; publishedAt: string; description?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = currentKeys().youtube;
  if (!key) throw new SourceError("No YouTube key added");
  const qs = new URLSearchParams({ ...params, key });
  const res = await get(`${API}/${path}?${qs}`, { gapMs: 150 });
  if (res.status === 403) {
    const reason = await res.clone().text().catch(() => "");
    if (/commentsDisabled/.test(reason)) throw new SourceError("Comments are turned off on this video", 403);
    throw new SourceError("YouTube quota exhausted or key rejected (403)", 403);
  }
  if (!res.ok) throw new SourceError(`YouTube HTTP ${res.status}`, res.status);
  return res.json() as Promise<T>;
}

function toPost(v: Video, region: RegionCode): Post {
  const n = (s?: string) => (s === undefined ? undefined : Number(s));
  return {
    id: `yt:${v.id}`,
    source: "youtube",
    title: stripHtml(v.snippet.title),
    url: `https://www.youtube.com/watch?v=${v.id}`,
    community: v.snippet.channelTitle,
    author: v.snippet.channelTitle,
    authorId: v.snippet.channelId,
    region,
    createdAt: v.snippet.publishedAt,
    views: n(v.statistics?.viewCount),
    score: n(v.statistics?.likeCount),
    comments: n(v.statistics?.commentCount),
    measured: true,
    snippet: v.snippet.description ? truncate(stripHtml(v.snippet.description), 200) : undefined,
  };
}

/** Trending videos in one country, optionally within one category. */
export async function mostPopular(regionCode: "IN" | "US", categoryId?: string, max = 15): Promise<Post[]> {
  const params: Record<string, string> = {
    part: "snippet,statistics", chart: "mostPopular", regionCode, maxResults: String(max),
  };
  if (categoryId) params.videoCategoryId = categoryId;
  const r = await yt<{ items?: Video[] }>("videos", params);
  return (r.items ?? []).map((v) => toPost(v, regionCode === "IN" ? "IN" : "GLOBAL"));
}

/** Most-viewed videos on a topic from the past week. ~101 quota units. */
export async function search(query: string, india: boolean, max = 12): Promise<{ posts: Post[]; total: number }> {
  const after = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const params: Record<string, string> = {
    part: "id", q: query, type: "video", order: "viewCount", maxResults: String(max), publishedAfter: after,
  };
  if (india) { params.regionCode = "IN"; params.relevanceLanguage = "en"; }
  const s = await yt<{ items?: { id: { videoId: string } }[]; pageInfo?: { totalResults?: number } }>("search", params);
  const ids = (s.items ?? []).map((i) => i.id.videoId).filter(Boolean);
  if (!ids.length) return { posts: [], total: s.pageInfo?.totalResults ?? 0 };
  const v = await yt<{ items?: Video[] }>("videos", { part: "snippet,statistics", id: ids.join(",") });
  return {
    posts: (v.items ?? []).map((x) => toPost(x, india ? "IN" : "GLOBAL")),
    total: s.pageInfo?.totalResults ?? ids.length,
  };
}

interface YtComment { id: string; snippet: { authorDisplayName: string; textOriginal?: string; textDisplay: string; likeCount?: number; publishedAt: string } }
interface YtThread { id: string; snippet: { topLevelComment: YtComment; totalReplyCount?: number }; replies?: { comments?: YtComment[] } }

/** A video's comments in YouTube's own "top" order, with a few replies each. 1 quota unit. */
export async function videoComments(post: Post, max = 20): Promise<Comment[]> {
  const videoId = post.id.replace(/^yt:/, "");
  const r = await yt<{ items?: YtThread[] }>("commentThreads", {
    part: "snippet,replies", videoId, order: "relevance", maxResults: String(Math.min(50, max)), textFormat: "plainText",
  });
  const toComment = (c: YtComment, parentId?: string): Comment => ({
    id: `ytc:${c.id}`,
    source: "youtube",
    postId: post.id,
    author: c.snippet.authorDisplayName.replace(/^@/, ""),
    text: truncate(stripHtml(c.snippet.textOriginal ?? c.snippet.textDisplay), 900),
    url: `https://www.youtube.com/watch?v=${videoId}&lc=${c.id}`,
    createdAt: c.snippet.publishedAt,
    score: c.snippet.likeCount,
    parentId,
    replies: [],
  });
  return (r.items ?? []).map((t) => {
    const top = toComment(t.snippet.topLevelComment);
    return {
      ...top,
      replyCount: t.snippet.totalReplyCount,
      replies: (t.replies?.comments ?? [])
        .map((c) => toComment(c, top.id))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3),
    };
  });
}

export interface ChannelInfo { id: string; subscribers: number | null; avatar: string | null; handle: string | null; country: string | null }

/** Subscriber counts and avatars for up to 50 channels per call. 1 quota unit per call. */
export async function channels(ids: string[]): Promise<Map<string, ChannelInfo>> {
  const out = new Map<string, ChannelInfo>();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 50) {
    const r = await yt<{ items?: { id: string; snippet?: { customUrl?: string; country?: string; thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }[] }>(
      "channels", { part: "snippet,statistics", id: unique.slice(i, i + 50).join(","), maxResults: "50" });
    for (const c of r.items ?? []) {
      out.set(c.id, {
        id: c.id,
        subscribers: c.statistics?.hiddenSubscriberCount || c.statistics?.subscriberCount === undefined ? null : Number(c.statistics.subscriberCount),
        avatar: c.snippet?.thumbnails?.default?.url ?? null,
        handle: c.snippet?.customUrl ?? null,
        country: c.snippet?.country ?? null,
      });
    }
  }
  return out;
}

/** The week's most-viewed videos for a query in one country's results. ~101 quota units. */
export async function searchRegion(query: string, regionCode: "IN" | "US", max = 25): Promise<Post[]> {
  const after = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const s = await yt<{ items?: { id: { videoId: string } }[] }>("search", {
    part: "id", q: query, type: "video", order: "viewCount", maxResults: String(max), publishedAfter: after,
    regionCode, relevanceLanguage: "en",
  });
  const ids = (s.items ?? []).map((i) => i.id.videoId).filter(Boolean);
  if (!ids.length) return [];
  const v = await yt<{ items?: Video[] }>("videos", { part: "snippet,statistics", id: ids.join(",") });
  return (v.items ?? []).map((x) => toPost(x, regionCode === "IN" ? "IN" : "GLOBAL"));
}

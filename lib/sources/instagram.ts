import { currentKeys } from "@/lib/keys";
import type { Post } from "@/lib/types";
import { truncate } from "@/lib/utils";
import { getJson, SourceError } from "./http";

/**
 * Instagram through Meta's official Graph API hashtag search, the only
 * free, legitimate way to read public Instagram engagement. It needs your own
 * Business or Creator account (INSTAGRAM_USER_ID) and a long-lived token
 * (INSTAGRAM_ACCESS_TOKEN). Meta allows 30 distinct hashtags per rolling
 * week, so it is used for Explore searches only, which are cached.
 * https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export const hasInstagram = () => Boolean(currentKeys().instagramToken && currentKeys().instagramUserId);

interface Media { id: string; caption?: string; media_type?: string; comments_count?: number; like_count?: number; permalink?: string; timestamp?: string }

/** A query as one hashtag: "iPhone Duo" → "iphoneduo". */
export const toHashtag = (q: string) => q.toLowerCase().replace(/[^a-z0-9_]/g, "");

export async function hashtagTop(query: string): Promise<Post[]> {
  if (!hasInstagram()) throw new SourceError("Add an Instagram token and user id in Keys to include Instagram");
  const tag = toHashtag(query);
  if (!tag) return [];
  const { instagramUserId, instagramToken } = currentKeys();
  const auth = `user_id=${instagramUserId}&access_token=${instagramToken}`;
  let found: { data?: { id: string }[] };
  try {
    found = await getJson(`${GRAPH}/ig_hashtag_search?q=${encodeURIComponent(tag)}&${auth}`);
  } catch (e) {
    throw new SourceError(`Instagram: ${(e as Error).message}. Check the token, or the weekly 30-hashtag limit`);
  }
  const id = found.data?.[0]?.id;
  if (!id) return [];
  const media = await getJson<{ data?: Media[] }>(
    `${GRAPH}/${id}/top_media?fields=id,caption,media_type,comments_count,like_count,permalink,timestamp&limit=25&${auth}`);
  return (media.data ?? []).filter((m) => m.permalink).map((m) => ({
    id: `ig:${m.id}`,
    source: "instagram" as const,
    title: truncate((m.caption ?? `#${tag} ${m.media_type?.toLowerCase() ?? "post"}`).replace(/\s+/g, " "), 160),
    url: m.permalink!,
    community: `#${tag}`,
    region: "GLOBAL" as const,
    createdAt: m.timestamp ?? null,
    // Meta hides likes on some posts; undefined, not zero.
    score: m.like_count,
    comments: m.comments_count,
    measured: true,
  }));
}

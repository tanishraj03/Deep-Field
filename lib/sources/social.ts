import { guessNiche } from "@/lib/niches";
import type { Signal } from "@/lib/types";
import { hash, stripHtml } from "@/lib/utils";
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

import type { Niche, RegionCode } from "@/lib/niches";
import { languageOf } from "@/lib/language";
import * as yt from "@/lib/sources/youtube";
import type { Creator, CreatorPlatform, Post } from "@/lib/types";

/**
 * Who is behind what's taking off in a niche: the YouTube channels and
 * Reddit posters whose posts drew the most reaction this week, Indian ones
 * and the rest. Built from posts the scan already read, plus, where a niche
 * has no YouTube trending chart, one YouTube search per region (100 quota
 * units each). Every number is the platform's own.
 *
 * X and Instagram share no creator data for free. Bluesky was tried and
 * left out: its niche searches surfaced accounts with a few dozen likes.
 */

const PER_LIST = 10;
const INDIAN = new Set(["Hindi", "Hinglish", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Marathi", "Odia", "Urdu"]);
const WEEK_MS = 7 * 86_400_000;

/** Reddit accounts that post a lot without being anyone: moderators' bots and the like. */
const NOT_CREATORS = /^(\[deleted\]|automoderator|.*bot|.*_bot|.*-bot|moderator)$/i;
/** Names that shouldn't headline a public page. */
const CRUDE = /(fuck|shit|slut|whore|porn|cum|dick|cock|pussy|nsfw|nude|boob|tits|sex|rape|nazi|nigg)/i;
/** Daily and weekly discussion threads are a moderator's job, not a creator's post. */
const MEGATHREAD = /\b(daily|weekly|monthly)\b.*\b(thread|discussion|megathread)\b|\bmega ?thread\b|\bdiscussion thread\b/i;

function reachOf(p: Post): number {
  if (p.source === "youtube") return p.views ?? 0;
  return (p.score ?? 0) + (p.comments ?? 0);
}

interface Group { platform: CreatorPlatform; id: string; name: string; region: RegionCode; posts: Post[] }

function group(posts: Post[], platform: CreatorPlatform, idOf: (p: Post) => string | undefined): Group[] {
  const map = new Map<string, Group>();
  for (const p of posts) {
    const id = idOf(p);
    if (!id || NOT_CREATORS.test(p.author ?? "") || CRUDE.test(p.author ?? "") || MEGATHREAD.test(p.title)) continue;
    const key = `${p.region}:${id}`;
    const g = map.get(key) ?? { platform, id, name: p.author ?? id, region: p.region, posts: [] };
    if (!g.posts.some((x) => x.id === p.id)) g.posts.push(p);
    map.set(key, g);
  }
  return [...map.values()];
}

/** The top PER_LIST per region, by total reaction, with at least some reaction measured. */
function rank(groups: Group[]): Group[] {
  const total = (g: Group) => g.posts.reduce((a, p) => a + reachOf(p), 0);
  return (["IN", "GLOBAL"] as RegionCode[]).flatMap((r) => groups
    .filter((g) => g.region === r && total(g) > 0)
    .sort((a, b) => total(b) - total(a) || b.posts.length - a.posts.length)
    .slice(0, PER_LIST));
}

function toCreator(g: Group, url: string, extra: { followers: number | null; avatar: string | null; name?: string | null }): Creator {
  const top = [...g.posts].sort((a, b) => reachOf(b) - reachOf(a))[0];
  return {
    platform: g.platform,
    id: g.id,
    name: extra.name || g.name,
    url,
    avatar: extra.avatar,
    region: g.region,
    followers: extra.followers,
    posts: g.posts.length,
    reach: g.posts.reduce((a, p) => a + reachOf(p), 0),
    top: { title: top.title, url: top.url, reach: reachOf(top) },
  };
}

/**
 * One phrase per niche for the YouTube search, for niches without a
 * trending chart. Specific on purpose: a broad word like
 * "investing" or "share" pulls in whatever viral post happens to use it.
 */
const PHRASES: Record<string, string> = {
  "tech-ai": "AI tools", money: "personal finance", startups: "startup founder", careers: "career advice",
  fitness: "workout routine", beauty: "skincare routine", fashion: "outfit ideas", food: "easy recipe",
  entertainment: "box office", music: "new album", gaming: "video game", sports: "cricket match",
  life: "relationship advice", news: "breaking news", internet: "viral meme", creators: "content creator",
  travel: "travel vlog", education: "study tips", auto: "electric car", cities: "city life",
};
const phraseOf = (n: Niche) => PHRASES[n.id] ?? n.label.replace(/&/g, " ");

export async function buildCreators(niche: Niche, scanned: Post[]): Promise<Creator[]> {
  const now = Date.now();
  const thisWeek = (p: Post) => !p.createdAt || now - Date.parse(p.createdAt) <= WEEK_MS;
  const posts = scanned.filter(thisWeek);

  // YouTube: the niche's trending chart when it has one; otherwise its most-viewed videos this week.
  let videos = posts.filter((p) => p.source === "youtube" && p.authorId);
  if (!videos.length && yt.hasYouTube()) {
    const found = await Promise.all((["IN", "US"] as const).map((r) => yt.searchRegion(phraseOf(niche), r).catch(() => [])));
    videos = found.flat();
  }
  // India means Indian creators: the channel's own country decides, and the
  // chart or search a video came from only when the channel doesn't say.
  const channels = yt.hasYouTube() && videos.length
    ? await yt.channels(videos.map((v) => v.authorId!)).catch(() => new Map<string, yt.ChannelInfo>())
    : new Map<string, yt.ChannelInfo>();
  // No country: an Indian-language title means India; otherwise global if
  // the US chart or search found it too, India if only India's did. A video found by both searches counts once. The global list
  // keeps to English, so it stays usable for an English-speaking audience.
  const seen = new Set<string>();
  const placed = videos.flatMap((v) => {
    if (seen.has(v.id)) return [];
    seen.add(v.id);
    const country = channels.get(v.authorId!)?.country;
    const lang = languageOf(v.title);
    const foundGlobally = videos.some((x) => x.id === v.id && x.region === "GLOBAL");
    const region: RegionCode = country ? (country === "IN" ? "IN" : "GLOBAL")
      : INDIAN.has(lang) ? "IN"
      : foundGlobally ? "GLOBAL" : "IN";
    if (region === "GLOBAL" && lang !== "English") return [];
    return [{ ...v, region }];
  });
  const ytTop = rank(group(placed, "youtube", (p) => p.authorId));

  // Reddit: whoever posted in the niche's communities, India's or the rest.
  const rdTop = rank(group(posts.filter((p) => p.source === "reddit" && p.measured), "reddit", (p) => p.author));

  return [
    ...ytTop.map((g) => {
      const c = channels.get(g.id);
      const url = c?.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${g.id}`;
      return toCreator(g, url, { followers: c?.subscribers ?? null, avatar: c?.avatar ?? null });
    }),
    ...rdTop.map((g) => toCreator(g, `https://www.reddit.com/user/${g.id}/`, { followers: null, avatar: null, name: `u/${g.id}` })),
  ];
}

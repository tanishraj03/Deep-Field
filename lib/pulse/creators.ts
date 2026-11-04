import { languageOf } from "@/lib/language";
import type { Niche, RegionCode } from "@/lib/niches";
import * as yt from "@/lib/sources/youtube";
import { store } from "@/lib/store";
import type { Creator, CreatorPlatform, Post, Topic } from "@/lib/types";
import { terms } from "@/lib/utils";

/**
 * Who is behind what's taking off in a niche, scored so the list is the
 * creators worth knowing, not just whoever had one lucky video.
 *
 * Each scan adds the YouTube channels and Reddit posters it saw to a 30-day
 * history per niche (creatorhist:<niche>), so the page can rank this week
 * and this month. A creator's score, 0–100:
 *
 *   reach        views (YouTube) or upvotes + comments (Reddit), on a log scale
 *   breakout     views against subscribers: a small channel pulling millions is viral
 *   relevance    how many of their posts are about what the niche is discussing now
 *   consistency  more than one hit
 *
 * minus a penalty for channels that re-upload TikTok clips. India means
 * evidence the creator is Indian: the channel's country, YouTube's
 * spoken-language code, an Indian-language title, or India-only words.
 * Trending in India's chart alone isn't enough: foreign videos trend there.
 *
 * X and Instagram share no creator data for free, so they aren't here.
 */

const PER_LIST = 10;
const DAY = 86_400_000;
const KEEP_DAYS = 30;
/** Candidates per platform and region kept in the history each scan, so it stays small. */
const KEEP_PER_SCAN = 40;

const INDIAN = new Set(["Hindi", "Hinglish", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Gujarati", "Punjabi", "Marathi", "Odia", "Urdu"]);
const INDIAN_CODES = /^(hi|ta|te|kn|ml|bn|gu|pa|mr|or|ur|as|bho|en-IN)\b/i;
const INDIA_WORDS = /₹|\b(india|indian|bharat|lakh|crore|rupees?|jio|ipl|bollywood|desi)\b/i;

/** Reddit accounts that post a lot without being anyone: moderators' bots and the like. */
const NOT_CREATORS = /^(\[deleted\]|automoderator|.*bot|.*_bot|.*-bot|moderator)$/i;
/** Names that shouldn't headline a public page. */
const CRUDE = /(fuck|shit|slut|whore|porn|cum|dick|cock|pussy|nsfw|nude|boob|tits|sex|rape|nazi|nigg)/i;
/** Daily and weekly discussion threads are a moderator's job, not a creator's post. */
const MEGATHREAD = /\b(daily|weekly|monthly)\b.*\b(thread|discussion|megathread)\b|\bmega ?thread\b|\bdiscussion thread\b/i;
/** Channels that re-post other people's TikToks: big numbers, nobody to work with. */
const REUPLOAD = /#tiktok|#noads|\bpart \d+\s*$|#fyp\b|#foryou\b/i;

/**
 * One phrase per niche for the YouTube search, for niches without a
 * trending chart. Specific on purpose: a broad word like "investing" or
 * "share" pulls in whatever viral post happens to use it.
 */
const PHRASES: Record<string, string> = {
  "tech-ai": "AI tools", money: "personal finance", startups: "startup founder", careers: "career advice",
  fitness: "workout routine", beauty: "skincare routine", fashion: "outfit ideas", food: "easy recipe",
  entertainment: "box office", music: "new album", gaming: "video game", sports: "cricket match",
  life: "relationship advice", news: "breaking news", internet: "viral meme", creators: "content creator",
  travel: "travel vlog", education: "study tips", auto: "electric car", cities: "city life",
};
const phraseOf = (n: Niche) => PHRASES[n.id] ?? n.label.replace(/&/g, " ");

interface SeenPost { title: string; url: string; reach: number; createdAt: string | null }
interface Seen {
  platform: CreatorPlatform;
  id: string;
  name: string;
  url: string;
  avatar: string | null;
  followers: number | null;
  region: RegionCode;
  posts: Record<string, SeenPost>;
}
interface History { since: string; creators: Record<string, Seen> }

const reachOf = (p: Post) => (p.source === "youtube" ? p.views ?? 0 : (p.score ?? 0) + (p.comments ?? 0));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Is this creator Indian? Only on evidence. */
function isIndian(country: string | null | undefined, posts: Post[]): boolean {
  if (country) return country === "IN";
  return posts.some((p) => (p.lang && INDIAN_CODES.test(p.lang)) || INDIAN.has(languageOf(p.title)) || INDIA_WORDS.test(p.title));
}

/** Words that say what the niche is about right now: its keywords and this scan's topics. */
function nicheTerms(niche: Niche, topics: Topic[]): Set<string> {
  return new Set([
    ...niche.keywords.flatMap((k) => terms(k)),
    ...topics.flatMap((t) => [...terms(t.title), ...terms(t.query ?? "")]),
  ]);
}

function score(c: Seen, posts: SeenPost[], words: Set<string>): { score: number; reach: number; breakout: number | null } {
  const reach = posts.reduce((a, p) => a + p.reach, 0);
  const relevant = posts.filter((p) => terms(p.title).some((w) => words.has(w))).length / Math.max(1, posts.length);
  const consistency = Math.min(posts.length, 4) / 4;
  if (c.platform === "youtube") {
    const reachN = clamp01((Math.log10(Math.max(1, reach)) - 4) / 3); // 10K views → 0, 10M → 1
    const breakout = c.followers ? reach / c.followers : null;
    const breakoutN = breakout === null ? 0.5 : clamp01((Math.log10(Math.max(1e-4, breakout)) + 2) / 2); // 1% of subs → 0, 1x → 1
    // Re-upload farms are exactly what a huge views-to-subscribers ratio also rewards, so the penalty is heavy.
    const reupload = posts.some((p) => REUPLOAD.test(p.title)) ? 30 : 0;
    const s = 100 * (0.35 * reachN + 0.25 * breakoutN + 0.25 * relevant + 0.15 * consistency) - reupload;
    return { score: Math.max(0, Math.round(s)), reach, breakout };
  }
  const reachN = clamp01((Math.log10(Math.max(1, reach)) - 2) / 2.7); // 100 → 0, 50K → 1
  return { score: Math.round(100 * (0.45 * reachN + 0.35 * relevant + 0.2 * consistency)), reach, breakout: null };
}

/** Rank the history for a window: the top PER_LIST per platform and region, by score. */
function ranked(h: History, sinceMs: number, words: Set<string>): Creator[] {
  const out: Creator[] = [];
  for (const c of Object.values(h.creators)) {
    const posts = Object.values(c.posts).filter((p) => !p.createdAt || Date.parse(p.createdAt) >= sinceMs);
    if (!posts.length) continue;
    const s = score(c, posts, words);
    if (!s.reach) continue;
    const top = [...posts].sort((a, b) => b.reach - a.reach)[0];
    out.push({
      platform: c.platform, id: c.id, name: c.name, url: c.url, avatar: c.avatar, region: c.region, followers: c.followers,
      posts: posts.length, reach: s.reach, score: s.score, breakout: s.breakout,
      top: { title: top.title, url: top.url, reach: top.reach },
    });
  }
  const lists: Creator[] = [];
  for (const platform of ["youtube", "reddit"] as CreatorPlatform[]) {
    for (const region of ["IN", "GLOBAL"] as RegionCode[]) {
      lists.push(...out.filter((c) => c.platform === platform && c.region === region)
        .sort((a, b) => b.score - a.score || b.reach - a.reach).slice(0, PER_LIST));
    }
  }
  return lists;
}

/** This scan's candidates, grouped by creator. */
function candidates(posts: Post[], platform: CreatorPlatform, idOf: (p: Post) => string | undefined) {
  const map = new Map<string, Post[]>();
  for (const p of posts) {
    const id = idOf(p);
    if (!id || NOT_CREATORS.test(p.author ?? "") || CRUDE.test(p.author ?? "") || MEGATHREAD.test(p.title)) continue;
    const list = map.get(id) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(p);
    map.set(id, list);
  }
  return map;
}

export interface CreatorLists { week: Creator[]; month: Creator[]; since: string }

export async function buildCreators(niche: Niche, scanned: Post[], topics: Topic[]): Promise<CreatorLists> {
  const now = Date.now();
  const recent = scanned.filter((p) => !p.createdAt || now - Date.parse(p.createdAt) <= 7 * DAY);
  const key = `creatorhist:${niche.id}`;
  const h: History = (await store.get<History>(key).catch(() => null))?.value ?? { since: new Date(now).toISOString(), creators: {} };

  // YouTube: the niche's trending chart when it has one; otherwise its most-viewed videos this week.
  let videos = recent.filter((p) => p.source === "youtube" && p.authorId);
  if (!videos.length && yt.hasYouTube()) {
    const found = await Promise.all((["IN", "US"] as const).map((r) => yt.searchRegion(phraseOf(niche), r).catch(() => [])));
    videos = found.flat();
  }
  const byChannel = candidates(videos, "youtube", (p) => p.authorId);
  const channels = yt.hasYouTube() && byChannel.size
    ? await yt.channels([...byChannel.keys()]).catch(() => new Map<string, yt.ChannelInfo>())
    : new Map<string, yt.ChannelInfo>();

  const add = (platform: CreatorPlatform, id: string, posts: Post[], meta: Omit<Seen, "platform" | "id" | "posts">) => {
    const k = `${platform}:${id}`;
    const prev = h.creators[k];
    const merged: Record<string, SeenPost> = { ...(prev?.posts ?? {}) };
    for (const p of posts) merged[p.id] = { title: p.title, url: p.url, reach: reachOf(p), createdAt: p.createdAt };
    h.creators[k] = { platform, id, ...meta, posts: merged };
  };

  const top = (m: Map<string, Post[]>, region: (posts: Post[], id: string) => RegionCode) =>
    [...m.entries()].map(([id, posts]) => ({ id, posts, region: region(posts, id), reach: posts.reduce((a, p) => a + reachOf(p), 0) }))
      .sort((a, b) => b.reach - a.reach);

  const ytRows = top(byChannel, (posts, id) => (isIndian(channels.get(id)?.country, posts) ? "IN" : "GLOBAL"));
  for (const region of ["IN", "GLOBAL"] as RegionCode[]) {
    for (const r of ytRows.filter((x) => x.region === region).slice(0, KEEP_PER_SCAN)) {
      // The global list keeps to English videos, so it stays usable for an English-speaking audience.
      const posts = region === "GLOBAL" ? r.posts.filter((p) => languageOf(p.title) === "English") : r.posts;
      if (!posts.length) continue;
      const c = channels.get(r.id);
      add("youtube", r.id, posts, {
        name: posts[0].author ?? r.id,
        url: c?.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${r.id}`,
        avatar: c?.avatar ?? null, followers: c?.subscribers ?? null, region,
      });
    }
  }

  // Reddit: whoever posted in the niche's communities; India means its Indian communities.
  const rdRows = top(candidates(recent.filter((p) => p.source === "reddit" && p.measured), "reddit", (p) => p.author),
    (posts) => (posts.filter((p) => p.region === "IN").length > posts.length / 2 ? "IN" : "GLOBAL"));
  for (const region of ["IN", "GLOBAL"] as RegionCode[]) {
    for (const r of rdRows.filter((x) => x.region === region).slice(0, KEEP_PER_SCAN)) {
      add("reddit", r.id, r.posts, { name: `u/${r.id}`, url: `https://www.reddit.com/user/${r.id}/`, avatar: null, followers: null, region });
    }
  }

  // Forget posts older than a month, and creators left with none.
  const cutoff = now - KEEP_DAYS * DAY;
  for (const [k, c] of Object.entries(h.creators)) {
    for (const [pid, p] of Object.entries(c.posts)) if (p.createdAt && Date.parse(p.createdAt) < cutoff) delete c.posts[pid];
    if (!Object.keys(c.posts).length) delete h.creators[k];
  }
  await store.set(key, h).catch(() => {});

  const words = nicheTerms(niche, topics);
  return { week: ranked(h, now - 7 * DAY, words), month: ranked(h, cutoff, words), since: h.since };
}

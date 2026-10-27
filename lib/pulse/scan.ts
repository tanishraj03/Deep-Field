import { backgroundModels } from "@/lib/ai/models";
import { NICHE_BY_ID, NICHES, type Niche, type RegionCode } from "@/lib/niches";
import * as arctic from "@/lib/sources/arctic";
import * as gnews from "@/lib/sources/googlenews";
import * as hn from "@/lib/sources/hackernews";
import { errMessage } from "@/lib/sources/http";
import * as reddit from "@/lib/sources/reddit";
import * as social from "@/lib/sources/social";
import * as trends from "@/lib/sources/trends";
import * as wiki from "@/lib/sources/wikipedia";
import * as xtrends from "@/lib/sources/xtrends";
import * as yt from "@/lib/sources/youtube";
import { store } from "@/lib/store";
import type { CommunityVolume, NicheScan, Post, Signal, SignalsScan, SourceRun, Topic, WebMentions } from "@/lib/types";
import { pool, shortQuery } from "@/lib/utils";
import { attachLeftovers, clusterByRules, clusterWithAI, type Draft } from "./cluster";
import { buildTopics, rescore } from "./score";

export const scanKey = (niche: string) => `scan:${niche}`;
export const summaryKey = (niche: string) => `summary:${niche}`;
export const SIGNALS_KEY = "signals";

/** Bump when scoring changes, so stored summaries are re-scored from their full scans. */
const SCORE_VERSION = 4;

/**
 * A scan cut down to what the Pulse board shows, no posts, angles or
 * questions, and scored once at write time. Full scans run to megabytes
 * across twenty niches; summaries keep the board quick to load.
 */
export function summarize(scan: NicheScan): NicheScan {
  const scored = rescore(scan);
  return {
    ...scored,
    posts: [],
    communities: scored.communities.map((c) => ({ ...c, daily: [] })),
    topics: scored.topics.map((t) => ({ ...t, angles: [], questions: [], whyNow: "", postIds: [] })),
    scoreVersion: SCORE_VERSION,
  };
}

/* Short in-process caches: pages render on every request, scans change every few minutes. */
const CACHE_MS = 20_000;
let summariesCache: { at: number; value: Pulse } | null = null;
let fullCache: { at: number; value: Pulse } | null = null;
function invalidate() { summariesCache = null; fullCache = null; }

/** Posts sent to the model per niche. Enough to see patterns, small enough to be fast. */
const CLUSTER_LIMIT = 220;

function rank(p: Post): number {
  const hot = p.hotRank ? 60 / (1 + p.hotRank / 10) : 0;
  const fresh = !p.measured ? 4 : 0;
  return reddit.engagement(p) + hot + fresh;
}

/**
 * Recurring threads, daily questions, weekly megathreads, promo threads , 
 * collect huge comment counts without being a conversation about anything.
 * Left in, they top every niche.
 */
const RECURRING = /\b(daily|weekly|monthly)\b.*\b(thread|megathread)\b|\bmega ?thread\b|simple questions|promotional content|self[- ]promo|\b(rate|moronic) monday\b|what are you (reading|watching|listening)/i;

/** Keep the strongest posts, without letting one region crowd out the other. */
function selectForClustering(posts: Post[]): Post[] {
  const sorted = posts.filter((p) => !RECURRING.test(p.title)).sort((a, b) => rank(b) - rank(a));
  const half = CLUSTER_LIMIT / 2;
  const IN = sorted.filter((p) => p.region === "IN");
  const GL = sorted.filter((p) => p.region === "GLOBAL");
  const pick = [...IN.slice(0, half), ...GL.slice(0, half)];
  const spare = CLUSTER_LIMIT - pick.length;
  const extra = sorted.filter((p) => !pick.includes(p)).slice(0, Math.max(0, spare));
  return [...pick, ...extra].sort((a, b) => rank(b) - rank(a));
}

async function readVolume(niche: Niche, previous: NicheScan | null) {
  const subs = (["IN", "GLOBAL"] as RegionCode[]).flatMap((r) => niche.subreddits[r].map((s) => ({ s, r })));
  const fresh = previous?.volumeAt && Date.now() - Date.parse(previous.volumeAt) < 20 * 3_600_000;
  const sameSubs = previous && previous.communities.length === subs.length &&
    previous.communities.some((c) => c.daily.length > 0);
  if (fresh && sameSubs) return { communities: previous!.communities, volumeAt: previous!.volumeAt, reused: true };

  const communities = await pool(subs, 8, async ({ s, r }): Promise<CommunityVolume> => {
    const daily = await arctic.dailyPosts(s, 14).catch(() => []);
    return {
      name: `r/${s}`, region: r,
      daily: daily.map((d) => d.value),
      postsWeek: daily.slice(-7).reduce((a, d) => a + d.value, 0),
    };
  });
  // A failed read comes back empty. Don't stamp it as fresh, or a zero would
  // be shown, and reused, for a day; leave it to be retried next scan.
  const read = communities.filter((c) => c.daily.length).length;
  return { communities, volumeAt: read >= subs.length / 2 ? new Date().toISOString() : null, reused: false };
}

function dailyVolumeOf(communities: CommunityVolume[]) {
  const days = Math.max(0, ...communities.map((c) => c.daily.length));
  const out: NicheScan["dailyVolume"] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - (days - i) * 86_400_000).toISOString().slice(0, 10);
    const row = { date, IN: 0, GLOBAL: 0 };
    for (const c of communities) {
      // Series end on the same day; align from the right.
      const v = c.daily[c.daily.length - (days - i)];
      if (v !== undefined) row[c.region] += v;
    }
    out.push(row);
  }
  return out;
}

export async function scanNiche(nicheId: string, opts: { ai?: boolean } = {}): Promise<NicheScan> {
  const niche = NICHE_BY_ID.get(nicheId);
  if (!niche) throw new Error(`Unknown niche "${nicheId}"`);
  const previous = (await store.get<NicheScan>(scanKey(nicheId)))?.value ?? null;
  const t0 = Date.now();
  const lap = (label: string) => { if (process.env.SCAN_DEBUG) console.log(`    ${label} +${((Date.now() - t0) / 1000).toFixed(1)}s`); };
  const sources: SourceRun[] = [];
  const posts = new Map<string, Post>();
  const add = (list: Post[]) => list.forEach((p) => { if (p.title && !posts.has(p.id)) posts.set(p.id, p); });

  // 1. Reddit communities: the core read in depth, the long tail lightly.
  // The archive limiter paces the requests, so the pool can run wide.
  const core = new Set([...niche.core.IN, ...niche.core.GLOBAL]);
  const subs = (["IN", "GLOBAL"] as RegionCode[]).flatMap((r) => niche.subreddits[r].map((s) => ({ s, r, tier: core.has(s) ? "core" as const : "tail" as const })));
  const failures: string[] = [];
  let via = "archive";
  const reads = await pool(subs, 8, async ({ s, r, tier }) => {
    try {
      const read = await reddit.readCommunity(s, r, tier);
      via = read.via;
      return read;
    } catch (e) {
      failures.push(`r/${s}: ${errMessage(e)}`);
      return null;
    }
  });
  reads.forEach((r) => r && add(r.posts));
  let postsRead = reads.reduce((a, r) => a + (r?.read ?? 0), 0);
  sources.push({
    source: via === "reddit-api" ? "Reddit API" : "Reddit (archive)",
    ok: reads.some(Boolean),
    count: reads.reduce((a, r) => a + (r?.posts.length ?? 0), 0),
    note: failures.length ? `${failures.length} of ${subs.length} communities failed: ${failures.slice(0, 2).join("; ")}` : undefined,
  });

  lap("reddit");
  // 2. Reddit's live "hot" ordering, when there is no API key. Best-effort.
  if (!reddit.hasRedditApi()) {
    let ranked = 0;
    let note: string | undefined;
    for (const region of ["IN", "GLOBAL"] as RegionCode[]) {
      try {
        // Reddit's multi-community feed takes a URL path, so only the core.
        const ranks = await reddit.hotRanks(niche.core[region]);
        for (const [id, r] of ranks) {
          const p = posts.get(id);
          if (p) { p.hotRank = r; ranked++; }
        }
      } catch (e) {
        note = `Live Reddit ranking unavailable (${errMessage(e)}); ranked by measured engagement`;
        break;
      }
    }
    sources.push({ source: "Reddit hot ranking", ok: !note, count: ranked, note });
  }

  lap("hot ranks");
  // 3. Hacker News, for the niches it covers.
  if (niche.hackerNews) {
    try {
      const front = await hn.frontPage();
      add(front);
      postsRead += front.length;
      sources.push({ source: "Hacker News", ok: true, count: front.length });
    } catch (e) {
      sources.push({ source: "Hacker News", ok: false, count: 0, note: errMessage(e) });
    }
  }

  // 4. YouTube trending in this category, India and US.
  if (niche.youtubeCategory) {
    if (!yt.hasYouTube()) {
      sources.push({ source: "YouTube", ok: false, count: 0, note: "Add YOUTUBE_API_KEY to include trending videos" });
    } else {
      const got: Post[] = [];
      const notes: string[] = [];
      for (const geo of ["IN", "US"] as const) {
        try { got.push(...await yt.mostPopular(geo, niche.youtubeCategory, 25)); }
        catch (e) { notes.push(`${geo}: ${errMessage(e)}`); }
      }
      add(got);
      postsRead += got.length;
      sources.push({ source: "YouTube", ok: got.length > 0, count: got.length, note: notes.join("; ") || undefined });
    }
  }

  // 5. Community volume, changes daily, so read at most once a day.
  const volume = await readVolume(niche, previous);

  lap("hn/youtube/volume");
  // 6. Group into conversations.
  const selected = selectForClustering([...posts.values()]);
  let drafts: Draft[] = [];
  let model: string | null = null;
  let aiNote: string | undefined;
  const slots = opts.ai === false ? [] : backgroundModels();
  if (slots.length && selected.length) {
    const failures: string[] = [];
    for (const slot of slots.slice(0, 3)) {
      try {
        const r = await clusterWithAI(slot.id, niche.label, selected);
        if (r.drafts.length) { drafts = r.drafts; model = r.model; break; }
        failures.push(`${slot.label}: no usable topics`);
      } catch (e) {
        failures.push(`${slot.label}: ${errMessage(e)}`);
      }
    }
    if (!drafts.length) aiNote = `AI grouping failed (${failures.join("; ")}); grouped by shared words instead.`;
  } else if (opts.ai !== false && !slots.length) {
    aiNote = "No AI key set, so topics are grouped by shared words. Add GEMINI_API_KEY for named conversations and content angles.";
  }
  lap("clustering");
  const groupedBy = drafts.length ? "ai" : "rules";
  if (!drafts.length) drafts = clusterByRules(selected);
  drafts = attachLeftovers(drafts, [...posts.values()]);

  const topics = buildTopics(niche.id, drafts, posts, groupedBy, previous?.topics ?? []);
  lap("topics");
  const counted = await countWebMentions(topics);
  sources.push({ source: "Web mentions (Bluesky, Hacker News)", ok: counted > 0, count: counted });
  lap("web mentions");
  const keep = new Set(topics.flatMap((t) => t.postIds));
  const scan: NicheScan = {
    niche: niche.id,
    scannedAt: new Date().toISOString(),
    topics,
    // Topic posts plus the strongest of the rest, for the "all threads" list.
    posts: [...posts.values()].filter((p) => keep.has(p.id))
      .concat(selected.filter((p) => !keep.has(p.id)).slice(0, 40)),
    communities: volume.communities,
    dailyVolume: dailyVolumeOf(volume.communities),
    volumeAt: volume.volumeAt,
    sources,
    postsRead,
    model,
    aiNote,
  };
  await store.set(scanKey(niche.id), scan);
  await store.set(summaryKey(niche.id), summarize(scan)).catch(() => {});
  invalidate();
  return scan;
}

/**
 * How many people are talking about each topic beyond the threads we grouped:
 * Bluesky's count of matching posts and Hacker News' count of matching
 * stories and comments, over the last week. Both are the platform's own
 * totals. Counted by the topic's search words, which the model writes as the
 * phrase people actually use; without one, the title's first content words.
 */
async function countWebMentions(topics: Topic[]): Promise<number> {
  let ok = 0;
  await pool(topics, 4, async (t) => {
    const query = t.query || shortQuery(t.title, 3);
    if (!query) return;
    const [bsky, hnCount] = await Promise.all([
      social.blueskyCount(query).catch(() => null),
      hn.mentions(query).catch(() => null),
    ]);
    const web: WebMentions = { query, bluesky: bsky?.count ?? null, blueskyCapped: bsky?.capped, hackernews: hnCount };
    t.web = web;
    if (bsky || hnCount !== null) ok++;
  });
  return ok;
}

export async function scanSignals(): Promise<SignalsScan> {
  const sources: SourceRun[] = [];
  const signals: Signal[] = [];
  const run = async (name: string, fn: () => Promise<Signal[]>) => {
    try {
      const got = await fn();
      signals.push(...got);
      sources.push({ source: name, ok: true, count: got.length });
    } catch (e) {
      sources.push({ source: name, ok: false, count: 0, note: errMessage(e) });
    }
  };
  await Promise.all([
    run("Google Trends India", () => trends.trending("IN")),
    run("Google Trends US", () => trends.trending("US")),
    run("Wikipedia India", () => wiki.topIndia(20)),
    run("Wikipedia global", () => wiki.topGlobal(20)),
    run("Bluesky trending", () => social.blueskyTrending()),
    run("Mastodon trending", () => social.mastodonTrending()),
    run("Mastodon shared links", () => social.mastodonLinks()),
    run("X trending India", () => xtrends.trending("IN")),
    run("X trending worldwide", () => xtrends.trending("GLOBAL")),
    run("Google News India", () => gnews.topStories("IN")),
    run("Google News US", () => gnews.topStories("US")),
  ]);
  const scan: SignalsScan = { scannedAt: new Date().toISOString(), signals, sources };
  await store.set(SIGNALS_KEY, scan);
  invalidate();
  return scan;
}

export interface Pulse {
  scans: NicheScan[];
  signals: SignalsScan | null;
}

const ORDER = new Map(NICHES.map((n, i) => [n.id, i]));
const inOrder = (scans: NicheScan[]) =>
  scans.filter((s) => ORDER.has(s.niche)).sort((a, b) => ORDER.get(a.niche)! - ORDER.get(b.niche)!);

/** Every niche's full scan, posts included. For the assistant; screens use loadSummaries. */
export async function loadPulse(): Promise<Pulse> {
  if (fullCache && Date.now() - fullCache.at < CACHE_MS) return fullCache.value;
  const [docs, signals] = await Promise.all([
    store.list<NicheScan>("scan:"),
    store.get<SignalsScan>(SIGNALS_KEY),
  ]);
  const value = { scans: inOrder(docs.map((d) => rescore(d.value))), signals: signals?.value ?? null };
  fullCache = { at: Date.now(), value };
  return value;
}

/**
 * Every niche's summary: what Pulse, Settings and Explore need, without
 * posts. A niche whose summary is missing or was scored by older formulas is
 * summarised from its full scan once, and the summary saved for next time.
 */
export async function loadSummaries(): Promise<Pulse> {
  if (summariesCache && Date.now() - summariesCache.at < CACHE_MS) return summariesCache.value;
  const [docs, signals] = await Promise.all([
    store.list<NicheScan>("summary:"),
    store.get<SignalsScan>(SIGNALS_KEY),
  ]);
  const have = new Map(docs.map((d) => d.value).filter((s) => s.scoreVersion === SCORE_VERSION).map((s) => [s.niche, s]));
  const missing = NICHES.filter((n) => !have.has(n.id));
  if (missing.length) {
    await pool(missing, 5, async (n) => {
      const full = await store.get<NicheScan>(scanKey(n.id));
      if (!full) return;
      const summary = summarize(full.value);
      have.set(n.id, summary);
      await store.set(summaryKey(n.id), summary).catch(() => {});
    });
  }
  const value = { scans: inOrder([...have.values()]), signals: signals?.value ?? null };
  summariesCache = { at: Date.now(), value };
  return value;
}

export async function loadScan(nicheId: string): Promise<NicheScan | null> {
  const doc = await store.get<NicheScan>(scanKey(nicheId));
  return doc ? rescore(doc.value) : null;
}

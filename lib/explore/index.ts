import { completeJSON } from "@/lib/ai/client";
import { backgroundModels, MODEL_BY_ID } from "@/lib/ai/models";
import { INSIGHT_SYSTEM, insightUser } from "@/lib/ai/prompts";
import { config } from "@/lib/config";
import { guessNiche, NICHE_BY_ID } from "@/lib/niches";
import { callOf, engagementOf, viralityOf } from "@/lib/pulse/score";
import * as gnews from "@/lib/sources/googlenews";
import * as hn from "@/lib/sources/hackernews";
import { errMessage } from "@/lib/sources/http";
import * as news from "@/lib/sources/news";
import * as ig from "@/lib/sources/instagram";
import * as reddit from "@/lib/sources/reddit";
import * as social from "@/lib/sources/social";
import * as wiki from "@/lib/sources/wikipedia";
import * as yt from "@/lib/sources/youtube";
import { store } from "@/lib/store";
import type { ExploreInsight, ExploreOpportunity, ExploreResult, ExploreSourceResult, Post, RegionFilter, Sentiment } from "@/lib/types";
import { compact, hash } from "@/lib/utils";

/** Big Indian communities searched directly, so India is not a sliver of a US-heavy sitewide search. */
const INDIA_CORE = ["india", "AskIndia", "indiadiscussion", "IndiaSpeaks", "bangalore", "mumbai", "delhi", "developersIndia", "IndiaInvestments", "IndianStreetBets"];
const GLOBAL_CORE = ["OutOfTheLoop", "worldnews", "technology", "AskReddit", "news"];

export function titleMatches(title: string, query: string): boolean {
  const t = title.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).every((w) => t.includes(w));
}

export function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, " ").slice(0, 80);
}

const resultKey = (q: string, region: RegionFilter) => `explore:${region}:${hash(normalizeQuery(q).toLowerCase())}`;
const insightKey = (q: string, region: RegionFilter) => `insight:${region}:${hash(normalizeQuery(q).toLowerCase())}`;

function days(n: number): string[] {
  return Array.from({ length: n }, (_, i) => new Date(Date.now() - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

async function settle<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, error: errMessage(e) }; }
}

export async function explore(rawQuery: string, region: RegionFilter, opts: { fresh?: boolean } = {}): Promise<ExploreResult> {
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) throw new Error("Type at least two characters.");
  const key = resultKey(query, region);
  if (!opts.fresh) {
    const hit = await store.get<ExploreResult>(key);
    if (hit && Date.now() - Date.parse(hit.updatedAt) < config.scan.exploreTtlMs) return hit.value;
  }

  const india = region === "IN";
  const niche = NICHE_BY_ID.get(guessNiche(query) ?? "");
  const indiaSubs = [...new Set([...(niche?.subreddits.IN ?? []), ...INDIA_CORE])].slice(0, 12);
  const globalSubs = [...new Set([...(niche?.subreddits.GLOBAL ?? []), ...GLOBAL_CORE])];

  const [redditR, indiaR, hnR, ytR, newsR, wikiR, bskyR, gnewsR, lemmyR, igR] = await Promise.all([
    region === "IN" ? Promise.resolve(null) : settle(() => reddit.searchReddit(query, { fallbackSubs: globalSubs })),
    region === "GLOBAL" ? Promise.resolve(null) : settle(() => reddit.searchReddit(query, { within: indiaSubs, fallbackSubs: indiaSubs })),
    india ? Promise.resolve(null) : settle(() => hn.search(query)),
    yt.hasYouTube() ? settle(() => yt.search(query, india)) : Promise.resolve(null),
    // GDELT allows one request every five seconds, so these two run in series.
    settle(async () => {
      const volume = await news.volume(query, india);
      const articles = await news.articles(query, india).catch(() => [] as Post[]);
      return { volume, articles };
    }),
    settle(() => wiki.attention(query)),
    india ? Promise.resolve(null) : settle(() => social.blueskySearch(query)),
    settle(async () => region === "ALL"
      ? [...await gnews.search(query, true), ...await gnews.search(query, false)]
      : gnews.search(query, india)),
    india ? Promise.resolve(null) : settle(() => social.lemmySearch(query)),
    ig.hasInstagram() ? settle(() => ig.hashtagTop(query)) : Promise.resolve(null),
  ]);

  const sources: ExploreSourceResult[] = [];
  const posts = new Map<string, Post>();
  const add = (list: Post[]) => list.forEach((p) => { if (!posts.has(p.id)) posts.set(p.id, p); });

  // Reddit: sitewide search, plus a direct search of Indian communities.
  let redditPosts: Post[] = [];
  const redditNotes: string[] = [];
  if (redditR) {
    if (redditR.ok) {
      redditPosts.push(...redditR.value.posts);
      if (redditR.value.note) redditNotes.push(redditR.value.note);
    } else redditNotes.push(`sitewide search failed: ${redditR.error}`);
  }
  if (indiaR) {
    if (indiaR.ok) {
      const seen = new Set(redditPosts.map((p) => p.id));
      // These communities are Indian by construction, whatever their name says.
      redditPosts.push(...indiaR.value.posts.filter((p) => !seen.has(p.id)).map((p) => ({ ...p, region: "IN" as const })));
      if (indiaR.value.note) redditNotes.push(indiaR.value.note);
    } else redditNotes.push(`India communities failed: ${indiaR.error}`);
  }
  if (region !== "ALL") redditPosts = redditPosts.filter((p) => p.region === region);
  add(redditPosts);
  sources.push({
    source: "reddit",
    ok: (redditR?.ok ?? false) || (indiaR?.ok ?? false),
    total: redditPosts.length,
    capped: redditPosts.length >= 100,
    window: "7 days",
    note: redditNotes.join(" · ") || (region === "IN" ? `searched ${indiaSubs.length} Indian communities` : undefined),
  });

  const hnDaily = new Map<string, number>();
  if (hnR) {
    if (hnR.ok) {
      add(hnR.value.posts);
      hnR.value.daily.forEach((v, k) => hnDaily.set(k, v));
      sources.push({ source: "hackernews", ok: true, total: hnR.value.week, window: "7 days" });
    } else sources.push({ source: "hackernews", ok: false, total: null, window: "7 days", note: hnR.error });
  }

  let ytPosts: Post[] = [];
  if (ytR) {
    if (ytR.ok) {
      ytPosts = ytR.value.posts;
      add(ytPosts);
      sources.push({ source: "youtube", ok: true, total: ytR.value.posts.length, window: "7 days", note: "most-viewed uploads this week" });
    } else sources.push({ source: "youtube", ok: false, total: null, window: "7 days", note: ytR.error });
  } else {
    sources.push({ source: "youtube", ok: false, total: null, window: "7 days", note: "Add YOUTUBE_API_KEY to include videos" });
  }

  // News: GDELT counts every article; Google News is the fallback count when
  // GDELT rate-limits, and the better list of headlines either way.
  let newsDaily = new Map<string, number>();
  const gnArticles = gnewsR.ok ? gnewsR.value.filter((p) => titleMatches(p.title, query) || gnewsR.value.length < 15) : [];
  add(gnArticles.slice(0, 40));
  if (newsR.ok) {
    newsDaily = newsR.value.volume;
    add(newsR.value.articles);
    const week = days(7).reduce((a, d) => a + (newsDaily.get(d) ?? 0), 0);
    sources.push({ source: "news", ok: true, total: week, window: "7 days", note: india ? "Indian publishers (GDELT)" : "worldwide publishers (GDELT)" });
  } else if (gnArticles.length) {
    for (const p of gnArticles) if (p.createdAt) newsDaily.set(p.createdAt.slice(0, 10), (newsDaily.get(p.createdAt.slice(0, 10)) ?? 0) + 1);
    sources.push({ source: "news", ok: true, total: gnArticles.length, capped: gnArticles.length >= 100, window: "7 days", note: "Google News articles (GDELT was rate limiting)" });
  } else sources.push({ source: "news", ok: false, total: null, window: "7 days", note: newsR.error });

  if (bskyR) {
    if (bskyR.ok) {
      add(bskyR.value.posts);
      sources.push({ source: "bluesky", ok: true, total: bskyR.value.total, capped: bskyR.value.capped, window: "7 days", note: "posts mentioning it" });
    } else sources.push({ source: "bluesky", ok: false, total: null, window: "7 days", note: bskyR.error });
  }
  if (lemmyR) {
    if (lemmyR.ok) {
      add(lemmyR.value);
      sources.push({ source: "lemmy", ok: true, total: lemmyR.value.length, capped: lemmyR.value.length >= 25, window: "7 days", note: "top posts on lemmy.world" });
    } else sources.push({ source: "lemmy", ok: false, total: null, window: "7 days", note: lemmyR.error });
  }
  if (igR) {
    if (igR.ok) {
      add(igR.value);
      sources.push({ source: "instagram", ok: true, total: igR.value.length, window: "top posts", note: `top posts for #${ig.toHashtag(query)}` });
    } else sources.push({ source: "instagram", ok: false, total: null, window: "top posts", note: igR.error });
  }

  const attention = wikiR.ok ? wikiR.value : null;
  sources.push({
    source: "wikipedia", ok: wikiR.ok && !!attention,
    total: attention ? attention.daily.slice(-7).reduce((a, d) => a + d.views, 0) : null,
    window: "7 days", note: wikiR.ok ? (attention ? `views of "${attention.article}"` : "no matching article") : wikiR.error,
  });

  const all = [...posts.values()];
  const dayKey = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const daily = days(14).map((date) => ({
    date,
    reddit: redditPosts.filter((p) => dayKey(p.createdAt) === date).length,
    hackernews: hnDaily.get(date) ?? 0,
    news: newsDaily.get(date) ?? 0,
    youtube: ytPosts.filter((p) => dayKey(p.createdAt) === date).length,
  }));

  const byCommunity = new Map<string, { name: string; posts: number; region: "IN" | "GLOBAL" }>();
  for (const p of redditPosts) {
    const c = byCommunity.get(p.community) ?? { name: p.community, posts: 0, region: p.region };
    c.posts++;
    byCommunity.set(p.community, c);
  }

  const counted = sources.filter((s) => s.ok && s.total !== null && ["reddit", "hackernews", "news", "bluesky", "lemmy", "instagram"].includes(s.source));
  const encoded = encodeURIComponent(query);
  const result: ExploreResult = {
    query,
    region,
    fetchedAt: new Date().toISOString(),
    sources,
    daily,
    attention,
    // Threads that name the topic in their title come first: Reddit's search
    // also matches post bodies, which surfaced "Meirl" at the top of "creatine".
    posts: all.sort((a, b) =>
      Number(titleMatches(b.title, query)) - Number(titleMatches(a.title, query)) ||
      reddit.engagement(b) - reddit.engagement(a)),
    communities: [...byCommunity.values()].sort((a, b) => b.posts - a.posts),
    regionSplit: {
      IN: all.filter((p) => p.region === "IN" && p.source !== "youtube").length,
      GLOBAL: all.filter((p) => p.region === "GLOBAL" && p.source !== "youtube").length,
    },
    totals: {
      conversations: counted.reduce((a, s) => a + (s.total ?? 0), 0) + ytPosts.length,
      comments: all.reduce((a, p) => a + (p.comments ?? 0), 0),
      score: all.reduce((a, p) => a + (p.source === "youtube" ? 0 : p.score ?? 0), 0),
      views: ytPosts.reduce((a, p) => a + (p.views ?? 0), 0),
    },
    // Where we cannot count, we can still send you to look.
    links: [
      { label: "Google Trends", url: `https://trends.google.com/trends/explore?q=${encoded}&date=now%207-d${india ? "&geo=IN" : ""}` },
      { label: "X", url: `https://x.com/search?q=${encoded}&f=live` },
      { label: "Instagram", url: `https://www.instagram.com/explore/search/keyword/?q=${encoded}` },
      { label: "TikTok", url: `https://www.tiktok.com/search?q=${encoded}` },
      { label: "YouTube", url: `https://www.youtube.com/results?search_query=${encoded}&sp=CAMSAggD` },
      { label: "Reddit", url: `https://www.reddit.com/search/?q=${encoded}&t=week` },
    ],
  };

  result.opportunity = opportunityOf(result, ytPosts);
  await store.set(key, result).catch(() => {});
  return result;
}

/**
 * Is a searched topic worth making content on, from the numbers alone? This
 * is computed before any model reads the posts, and the model may only move
 * it a little, so "worth it" has to be earned by real reaction and momentum.
 */
function opportunityOf(r: ExploreResult, videos: Post[]): ExploreOpportunity {
  const now = Date.now();
  const posts = r.posts;
  const engagement = posts.reduce((a, p) => a + engagementOf(p), 0);
  const first = Math.min(...posts.map((p) => (p.createdAt ? Date.parse(p.createdAt) : now)), now);
  const hours = Math.min(168, Math.max(2, (now - first) / 3_600_000));
  const perHour = Math.round(engagement / hours);
  const virality = viralityOf({ posts: posts.length, perHour, engagement });
  const perConversation = Math.round(engagement / Math.max(1, posts.length));

  const perDay = r.daily.map((d) => d.reddit + d.hackernews + d.news + d.youtube);
  const avg = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
  const prior = avg(perDay.slice(-7, -3));
  const momentum = prior > 0 ? Math.round((avg(perDay.slice(-3)) / prior) * 100) / 100 : null;
  const views = r.attention?.daily.map((d) => d.views) ?? [];
  const priorViews = avg(views.slice(-10, -3));
  const attention = views.length >= 10 && priorViews > 0 ? Math.round((avg(views.slice(-3)) / priorViews) * 100) / 100 : null;
  const videoViews = videos.reduce((a, p) => a + (p.views ?? 0), 0);

  const signals: string[] = [];
  let score = 0.45 * virality + Math.min(25, Math.log10(r.totals.conversations + 1) * 10);
  if (momentum !== null) {
    if (momentum >= 1.3) { score += 12; signals.push(`Rising: ${Math.round((momentum - 1) * 100)}% more conversation per day in the last 3 days`); }
    else if (momentum < 0.7) { score -= 10; signals.push(`Fading: ${Math.round((1 - momentum) * 100)}% less conversation per day in the last 3 days`); }
    else { score += 4; signals.push("Steady day to day"); }
  }
  if (attention !== null) {
    if (attention >= 1.3) { score += 5; signals.push(`Wikipedia interest up ${Math.round((attention - 1) * 100)}%`); }
    else if (attention < 0.7) { score -= 5; signals.push(`Wikipedia interest down ${Math.round((1 - attention) * 100)}%`); }
  }
  if (videos.length >= 8 && videoViews >= 10_000_000) {
    score -= 10;
    signals.push(`Crowded: ${videos.length} videos this week with ${compact(videoViews)} views`);
  }
  if (r.totals.conversations < 15) { score -= 15; signals.push(`Thin: only ${r.totals.conversations} conversations this week`); }
  signals.unshift(`~${compact(perHour)} reactions an hour, ${compact(perConversation)} per conversation`);

  score = Math.round(Math.max(0, Math.min(100, score)));
  return { virality, perHour, engagementPerConversation: perConversation, momentum, attention, saturation: { videos: videos.length, views: videoViews }, score, call: callOf(score), signals };
}

export async function cachedExplore(query: string, region: RegionFilter) {
  return (await store.get<ExploreResult>(resultKey(query, region)))?.value ?? null;
}

export async function cachedInsight(query: string, region: RegionFilter) {
  return (await store.get<ExploreInsight>(insightKey(query, region)))?.value ?? null;
}

const SENTIMENTS = new Set(["positive", "negative", "mixed", "neutral"]);

export async function exploreInsight(query: string, region: RegionFilter, modelId?: string): Promise<ExploreInsight> {
  const cachedInsight = await store.get<ExploreInsight>(insightKey(query, region));
  if (cachedInsight && Date.now() - Date.parse(cachedInsight.updatedAt) < config.scan.exploreTtlMs && !modelId) {
    return cachedInsight.value;
  }
  const result = (await cachedExplore(query, region)) ?? (await explore(query, region));
  const picked = modelId ? MODEL_BY_ID.get(modelId) : undefined;
  const slots = picked ? [picked] : backgroundModels().slice(0, 3);
  if (!slots.length) throw new Error("No AI model has a key yet. Add GEMINI_API_KEY (free) to get insights.");
  if (!result.posts.length) throw new Error("Not enough conversation found to interpret.");

  type Raw = Partial<Omit<ExploreInsight, "model" | "decision">> & {
    sentiment?: { label?: string; detail?: string };
    decision?: { call?: string; score?: number; headline?: string; reasons?: unknown[]; risks?: unknown[]; gap?: string };
  };
  let out: { data: Raw; model: string } | null = null;
  let lastError: unknown;
  for (const slot of slots) {
    try { out = await completeJSON<Raw>(slot.id, INSIGHT_SYSTEM, insightUser(result), 5000); break; }
    catch (e) { lastError = e; }
  }
  if (!out) throw lastError;
  const { data, model } = out;
  const insight: ExploreInsight = {
    summary: String(data.summary ?? ""),
    threads: (data.threads ?? []).filter((t) => t?.title).slice(0, 5),
    sentiment: {
      label: (SENTIMENTS.has(String(data.sentiment?.label)) ? data.sentiment!.label : "neutral") as Sentiment,
      detail: String(data.sentiment?.detail ?? ""),
    },
    questions: (data.questions ?? []).map(String).slice(0, 5),
    angles: (data.angles ?? []).filter((a) => a?.hook).slice(0, 6),
    verdict: "",
    decision: decisionOf(data.decision, result.opportunity?.score),
    model,
  };
  // Keep the model's headline only if its call survived the clamp; otherwise
  // it would say "make" above a "skip" badge.
  const headline = String(data.decision?.headline ?? data.verdict ?? "");
  insight.verdict = !insight.decision || data.decision?.call === insight.decision.call ? headline : "";
  await store.set(insightKey(query, region), insight).catch(() => {});
  return insight;
}

/**
 * The model's call, held to the computed score: it may move the number by 15
 * at most, and the call is re-derived from the final number, so a model that
 * cheerleads cannot turn a fading topic into "make now".
 */
function decisionOf(
  d: { call?: string; score?: number; reasons?: unknown[]; risks?: unknown[]; gap?: string } | undefined,
  computed: number | undefined,
): ExploreInsight["decision"] {
  if (!d && computed === undefined) return undefined;
  const asked = Number(d?.score);
  let score = Number.isFinite(asked) ? asked : computed ?? 50;
  if (computed !== undefined) score = Math.max(computed - 15, Math.min(computed + 15, score));
  score = Math.round(Math.max(0, Math.min(100, score)));
  return {
    call: callOf(score),
    score,
    reasons: (d?.reasons ?? []).map(String).filter(Boolean).slice(0, 3),
    risks: (d?.risks ?? []).map(String).filter(Boolean).slice(0, 2),
    gap: String(d?.gap ?? ""),
  };
}

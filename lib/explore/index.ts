import { completeJSON } from "@/lib/ai/client";
import { backgroundModels, MODEL_BY_ID } from "@/lib/ai/models";
import { INSIGHT_SYSTEM, insightUser } from "@/lib/ai/prompts";
import { config } from "@/lib/config";
import { guessNiche, NICHE_BY_ID } from "@/lib/niches";
import * as hn from "@/lib/sources/hackernews";
import { errMessage } from "@/lib/sources/http";
import * as news from "@/lib/sources/news";
import * as reddit from "@/lib/sources/reddit";
import * as wiki from "@/lib/sources/wikipedia";
import * as yt from "@/lib/sources/youtube";
import { store } from "@/lib/store";
import type { ExploreInsight, ExploreResult, ExploreSourceResult, Post, RegionFilter, Sentiment } from "@/lib/types";
import { hash } from "@/lib/utils";

/** Big Indian communities searched directly, so India is not a sliver of a US-heavy sitewide search. */
const INDIA_CORE = ["india", "AskIndia", "indiadiscussion", "IndiaSpeaks", "bangalore", "mumbai", "delhi", "developersIndia", "IndiaInvestments", "IndianStreetBets"];
const GLOBAL_CORE = ["OutOfTheLoop", "worldnews", "technology", "AskReddit", "news"];

function titleMatches(title: string, query: string): boolean {
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

  const [redditR, indiaR, hnR, ytR, newsR, wikiR] = await Promise.all([
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

  let newsDaily = new Map<string, number>();
  if (newsR.ok) {
    newsDaily = newsR.value.volume;
    add(newsR.value.articles);
    const week = days(7).reduce((a, d) => a + (newsDaily.get(d) ?? 0), 0);
    sources.push({ source: "news", ok: true, total: week, window: "7 days", note: india ? "Indian publishers" : "worldwide publishers" });
  } else sources.push({ source: "news", ok: false, total: null, window: "7 days", note: newsR.error });

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

  const counted = sources.filter((s) => s.ok && s.total !== null && ["reddit", "hackernews", "news"].includes(s.source));
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

  await store.set(key, result).catch(() => {});
  return result;
}

export async function cachedExplore(query: string, region: RegionFilter) {
  return (await store.get<ExploreResult>(resultKey(query, region)))?.value ?? null;
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

  type Raw = Partial<Omit<ExploreInsight, "model">> & { sentiment?: { label?: string; detail?: string } };
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
    verdict: String(data.verdict ?? ""),
    model,
  };
  await store.set(insightKey(query, region), insight).catch(() => {});
  return insight;
}

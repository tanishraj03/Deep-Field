import type { NicheScan, Post, SourceId, Topic, TopicMetrics, TopicVerdict } from "@/lib/types";
import { compact, noEmDash } from "@/lib/utils";
import { hash, jaccard, terms } from "@/lib/utils";
import type { Draft } from "./cluster";

/** One post's reaction: comments, upvotes or likes, and views at 100 to one. */
export function engagementOf(p: Post): number {
  return (p.comments ?? 0) + (p.score ?? 0) + (p.views ?? 0) / 100;
}

/** `now` is when the posts were read, so a stored scan's pace does not decay as it ages. */
export function metricsFor(posts: Post[], now = Date.now()): TopicMetrics {
  const dayAgo = now - 86_400_000;
  const sources: Partial<Record<SourceId, number>> = {};
  for (const p of posts) sources[p.source] = (sources[p.source] ?? 0) + 1;
  const engagement = posts.reduce((a, p) => a + engagementOf(p), 0);
  const first = Math.min(...posts.map((p) => (p.createdAt ? Date.parse(p.createdAt) : now)));
  // At least two hours, so a thread posted ten minutes ago cannot claim a
  // thousand-per-hour pace off its first few votes.
  const hours = Math.max(2, (now - first) / 3_600_000);
  return {
    posts: posts.length,
    comments: posts.reduce((a, p) => a + (p.comments ?? 0), 0),
    score: posts.reduce((a, p) => a + (p.source === "youtube" ? 0 : p.score ?? 0), 0),
    views: posts.reduce((a, p) => a + (p.views ?? 0), 0),
    engagement: Math.round(engagement),
    mentions: posts.length + posts.reduce((a, p) => a + (p.comments ?? 0), 0),
    perHour: Math.round(engagement / hours),
    communities: new Set(posts.map((p) => p.community)).size,
    postsIN: posts.filter((p) => p.region === "IN").length,
    postsGLOBAL: posts.filter((p) => p.region === "GLOBAL").length,
    last24h: posts.filter((p) => p.createdAt && Date.parse(p.createdAt) >= dayAgo).length,
    sources,
  };
}

/**
 * Heat, 0–100, on one absolute scale so topics compare across niches: how big
 * the conversation is and how much it is moving.
 *
 * Inputs are only things the platforms reported. Reaction, comments,
 * upvotes/likes and views, carries most of the weight, because that is what
 * decides whether content on it lands; breadth (posts, communities) and
 * velocity (posts in the last day) add to it. Logs keep a single mega-thread
 * from drowning out a conversation happening everywhere at once.
 */
export function heatOf(m: TopicMetrics, posts: Post[]): number {
  const hot = posts.reduce((a, p) => a + (p.hotRank ? Math.max(0, 1 - p.hotRank / 100) : 0), 0);
  const raw =
    Math.log1p(m.comments) * 1.0 +
    Math.log1p(m.score) * 0.8 +
    Math.log1p(m.views) * 0.7 +
    Math.min(m.posts, 20) * 0.5 +
    Math.min(m.communities, 8) * 1.0 +
    Math.min(m.last24h, 10) * 0.6 +
    Math.min(hot, 5) * 1.0;
  return Math.round(100 * (1 - Math.exp(-raw / 24)));
}

/**
 * Virality, 0–100: not how much is being said but how fast it is spreading.
 * Mostly engagement per hour since the first post, plus how hard the average
 * post lands, one thread pulling thousands of reactions is viral even alone.
 * Roughly: 10 reactions/hour ≈ 35, 100/hour ≈ 55, 1,000/hour ≈ 75, 10,000+ ≈ 90.
 */
export function viralityOf(m: Pick<TopicMetrics, "posts" | "perHour" | "engagement">): number {
  if (!m.posts) return 0;
  const raw = 0.75 * Math.log1p(m.perHour) + 0.25 * Math.log1p(m.engagement / m.posts);
  return Math.round(100 * (1 - Math.exp(-raw / 4.4)));
}

/** Make / test / skip from a 0–100 opportunity score, one cut for every screen. */
export const callOf = (score: number): TopicVerdict["call"] => (score >= 62 ? "make" : score >= 42 ? "test" : "skip");

/**
 * Make now / Worth testing / Skip, from the numbers alone, so the call is
 * consistent and explainable. Most topics should not be "make now": it needs
 * real reaction that is still building, not just a lot of threads.
 */
export function verdictOf(t: Pick<Topic, "heat" | "virality" | "heatDelta" | "isNew" | "metrics">, posts: Post[]): TopicVerdict {
  const m = t.metrics;
  const reasons: { w: number; text: string }[] = [];
  let score = 0.45 * t.virality + 0.3 * t.heat;

  if (m.perHour >= 500) reasons.push({ w: 3, text: `Spreading fast: ~${compact(m.perHour)} reactions an hour` });
  else if (m.perHour < 20) reasons.push({ w: 2, text: `Slow reaction: under 20 interactions an hour` });
  else reasons.push({ w: 0, text: `~${compact(m.perHour)} reactions an hour` });

  // "New" is weak evidence, a re-scan can rename a topic, so it only helps
  // when fresh threads back it up.
  if (t.isNew && t.virality >= 45 && m.last24h >= 2) { score += 4; reasons.push({ w: 2, text: "New since the last scan, with fresh threads today" }); }
  else if (t.heatDelta !== null && t.heatDelta >= 5) { score += 8; reasons.push({ w: 2, text: `Rising: heat up ${t.heatDelta} since the last scan` }); }
  else if (t.heatDelta !== null && t.heatDelta <= -5) { score -= 12; reasons.push({ w: 3, text: `Cooling: heat down ${-t.heatDelta} since the last scan` }); }

  if (m.last24h >= 3) { score += 6; reasons.push({ w: 1, text: `${m.last24h} new threads in the last 24 hours` }); }
  else if (m.last24h === 0) { score -= 5; reasons.push({ w: 1, text: "No new threads in the last 24 hours" }); }

  // Lots of big videos already means creators got there first.
  const videos = posts.filter((p) => p.source === "youtube");
  const videoViews = videos.reduce((a, p) => a + (p.views ?? 0), 0);
  if (videos.length >= 4 && videoViews >= 5_000_000) {
    score -= 8;
    reasons.push({ w: 2, text: `Already crowded: ${videos.length} videos with ${compact(videoViews)} views` });
  }
  if (m.posts <= 2 && m.communities <= 1) {
    score -= 10;
    reasons.push({ w: 2, text: `Thin: ${m.posts} ${m.posts === 1 ? "thread" : "threads"} in one community` });
  } else if (m.communities >= 5) {
    reasons.push({ w: 1, text: `Broad: across ${m.communities} communities` });
  }

  score = Math.round(Math.max(0, Math.min(100, score)));
  const call = callOf(score);
  return { call, score, reasons: reasons.sort((a, b) => b.w - a.w).slice(0, 3).map((r) => r.text) };
}

function regional(posts: Post[], now?: number) {
  const metrics = metricsFor(posts, now);
  return posts.length
    ? { metrics, heat: heatOf(metrics, posts), virality: viralityOf(metrics) }
    : { metrics, heat: 0, virality: 0 };
}

/**
 * Re-score a stored scan with the current formulas. Scans are kept for hours
 * and formulas change; scoring on read keeps every screen on one scale.
 */
export function rescore(scan: NicheScan): NicheScan {
  const byId = new Map(scan.posts.map((p) => [p.id, p]));
  const now = Date.parse(scan.scannedAt);
  const topics = scan.topics.map((t) => {
    const posts = t.postIds.map((id) => byId.get(id)).filter((p): p is Post => !!p);
    if (!posts.length) return t;
    const metrics = metricsFor(posts, now);
    const heat = heatOf(metrics, posts);
    const virality = viralityOf(metrics);
    // Text written before the no-em-dash rule is cleaned as it is read.
    const scored = {
      ...t, metrics, heat, virality,
      title: noEmDash(t.title), summary: noEmDash(t.summary), whyNow: noEmDash(t.whyNow),
      questions: t.questions.map(noEmDash), angles: t.angles.map((a) => ({ ...a, hook: noEmDash(a.hook) })),
    };
    return {
      ...scored,
      verdict: verdictOf(scored, posts),
      byRegion: {
        IN: regional(posts.filter((p) => p.region === "IN"), now),
        GLOBAL: regional(posts.filter((p) => p.region === "GLOBAL"), now),
      },
    };
  });
  return {
    ...scan,
    topics: topics.sort((a, b) => b.heat - a.heat),
    sources: scan.sources.map((s) => (s.note ? { ...s, note: noEmDash(s.note) } : s)),
    aiNote: scan.aiNote && noEmDash(scan.aiNote),
  };
}

export function buildTopics(
  niche: string,
  drafts: Draft[],
  byId: Map<string, Post>,
  groupedBy: "ai" | "rules",
  previous: Topic[] = [],
): Topic[] {
  const topics = drafts.map((d): Topic => {
    const posts = d.postIds.map((id) => byId.get(id)).filter((p): p is Post => !!p);
    const metrics = metricsFor(posts);
    return {
      id: hash(`${niche}:${d.title}:${d.postIds.slice(0, 3).join(",")}`),
      virality: viralityOf(metrics),
      verdict: { call: "skip", score: 0, reasons: [] },
      niche,
      title: d.title,
      summary: d.summary,
      whyNow: d.whyNow,
      sentiment: d.sentiment,
      questions: d.questions,
      angles: d.angles,
      postIds: d.postIds,
      query: d.query,
      metrics,
      heat: heatOf(metrics, posts),
      byRegion: {
        IN: regional(posts.filter((p) => p.region === "IN")),
        GLOBAL: regional(posts.filter((p) => p.region === "GLOBAL")),
      },
      heatDelta: null,
      // "New" only means something once there is a previous scan to compare to.
      isNew: previous.length > 0,
      groupedBy,
    };
  }).filter((t) => t.metrics.posts > 0);

  // Match each topic to its closest relative in the previous scan, by shared
  // threads first and shared words second, to say whether it is rising.
  const prev = previous.map((t) => ({ t, words: terms(`${t.title} ${t.summary}`), ids: new Set(t.postIds) }));
  for (const t of topics) {
    const words = terms(`${t.title} ${t.summary}`);
    let best: { t: Topic; s: number } | null = null;
    for (const p of prev) {
      const shared = t.postIds.filter((id) => p.ids.has(id)).length;
      const s = shared ? 0.5 + shared / t.postIds.length : jaccard(words, p.words);
      if (s >= 0.3 && (!best || s > best.s)) best = { t: p.t, s };
    }
    if (best) {
      t.isNew = false;
      t.heatDelta = t.heat - best.t.heat;
    }
  }
  const byIdPosts = (t: Topic) => t.postIds.map((id) => byId.get(id)).filter((p): p is Post => !!p);
  for (const t of topics) t.verdict = verdictOf(t, byIdPosts(t));
  return topics.sort((a, b) => b.heat - a.heat);
}

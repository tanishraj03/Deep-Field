import type { Post, SourceId, Topic, TopicMetrics } from "@/lib/types";
import { hash, jaccard, terms } from "@/lib/utils";
import type { Draft } from "./cluster";

export function metricsFor(posts: Post[]): TopicMetrics {
  const dayAgo = Date.now() - 86_400_000;
  const sources: Partial<Record<SourceId, number>> = {};
  for (const p of posts) sources[p.source] = (sources[p.source] ?? 0) + 1;
  return {
    posts: posts.length,
    comments: posts.reduce((a, p) => a + (p.comments ?? 0), 0),
    score: posts.reduce((a, p) => a + (p.source === "youtube" ? 0 : p.score ?? 0), 0),
    views: posts.reduce((a, p) => a + (p.views ?? 0), 0),
    communities: new Set(posts.map((p) => p.community)).size,
    postsIN: posts.filter((p) => p.region === "IN").length,
    postsGLOBAL: posts.filter((p) => p.region === "GLOBAL").length,
    last24h: posts.filter((p) => p.createdAt && Date.parse(p.createdAt) >= dayAgo).length,
    sources,
  };
}

/**
 * Heat, 0–100, on one absolute scale so topics compare across niches.
 *
 * Inputs are only things the platforms reported: discussion (comments),
 * approval (upvotes/likes), reach (views), breadth (how many posts and
 * communities), and velocity (posts in the last day). Logs keep a single
 * mega-thread from drowning out a conversation happening everywhere at once.
 * A big cross-community topic lands in the 80s–90s; one modest thread ~30.
 */
export function heatOf(m: TopicMetrics, posts: Post[]): number {
  const hot = posts.reduce((a, p) => a + (p.hotRank ? Math.max(0, 1 - p.hotRank / 100) : 0), 0);
  const raw =
    Math.log1p(m.comments) * 1.0 +
    Math.log1p(m.score) * 0.6 +
    Math.log1p(m.views) * 0.45 +
    Math.min(m.posts, 20) * 0.8 +
    Math.min(m.communities, 8) * 1.5 +
    Math.min(m.last24h, 10) * 0.7 +
    Math.min(hot, 5) * 1.2;
  return Math.round(100 * (1 - Math.exp(-raw / 22)));
}

function regional(posts: Post[]) {
  const metrics = metricsFor(posts);
  return { metrics, heat: posts.length ? heatOf(metrics, posts) : 0 };
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
      niche,
      title: d.title,
      summary: d.summary,
      whyNow: d.whyNow,
      sentiment: d.sentiment,
      questions: d.questions,
      angles: d.angles,
      postIds: d.postIds,
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
  return topics.sort((a, b) => b.heat - a.heat);
}

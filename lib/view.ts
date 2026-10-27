import type { Comment, Discussion, NicheScan, Post, RegionFilter, Topic, TopicMetrics } from "./types";

/** What a topic looks like through the region filter. */
export function topicIn(t: Topic, region: RegionFilter): { metrics: TopicMetrics; heat: number; virality: number } {
  if (region === "ALL" || !t.byRegion) return { metrics: t.metrics, heat: t.heat, virality: t.virality };
  return t.byRegion[region];
}

export type RankBy = "heat" | "virality";

export function visibleTopics(scan: NicheScan, region: RegionFilter, rankBy: RankBy = "heat"): Topic[] {
  return rankTopics(scan.topics.filter((t) => topicIn(t, region).metrics.posts > 0), region, rankBy);
}

export function rankTopics(topics: Topic[], region: RegionFilter, rankBy: RankBy = "heat"): Topic[] {
  return [...topics].sort((a, b) => (topicIn(b, region)[rankBy] ?? 0) - (topicIn(a, region)[rankBy] ?? 0));
}

export function postsFor(t: Topic, scan: Pick<NicheScan, "posts">, region: RegionFilter): Post[] {
  const byId = new Map(scan.posts.map((p) => [p.id, p]));
  return t.postIds
    .map((id) => byId.get(id))
    .filter((p): p is Post => !!p && (region === "ALL" || p.region === region));
}

/** Niche posts per day for the region, as chart rows. */
export function volumeRows(scan: NicheScan, region: RegionFilter) {
  return scan.dailyVolume.map((d) => ({
    date: d.date,
    IN: region === "GLOBAL" ? 0 : d.IN,
    GLOBAL: region === "IN" ? 0 : d.GLOBAL,
  }));
}

export function weeklyPosts(scan: NicheScan, region: RegionFilter) {
  return scan.communities
    .filter((c) => region === "ALL" || c.region === region)
    .reduce((a, c) => a + c.postsWeek, 0);
}

/** Every comment and reply in a discussion, by id. */
export function commentIndex(d: Discussion): Map<string, Comment> {
  const m = new Map<string, Comment>();
  for (const t of d.threads) for (const c of t.comments) {
    m.set(c.id, c);
    for (const r of c.replies) m.set(r.id, r);
  }
  return m;
}

/**
 * Everyone we can count talking about a topic: every post and comment in its
 * threads, plus matching posts on Bluesky and stories and comments on Hacker
 * News. Web counts are global, so the India filter leaves them out.
 */
export function mentionsOf(t: Topic, region: RegionFilter): { total: number; threads: number; bluesky: number; hackernews: number; capped: boolean } {
  const m = topicIn(t, region).metrics;
  const threads = m.mentions ?? m.posts + m.comments;
  const web = region === "IN" ? null : t.web;
  const bluesky = web?.bluesky ?? 0;
  const hackernews = web?.hackernews ?? 0;
  return { total: threads + bluesky + hackernews, threads, bluesky, hackernews, capped: Boolean(web?.blueskyCapped) };
}

import type { Comment, Discussion, NicheScan, Post, RegionFilter, Topic, TopicMetrics } from "./types";

/** What a topic looks like through the region filter. */
export function topicIn(t: Topic, region: RegionFilter): { metrics: TopicMetrics; heat: number } {
  if (region === "ALL" || !t.byRegion) return { metrics: t.metrics, heat: t.heat };
  return t.byRegion[region];
}

export function visibleTopics(scan: NicheScan, region: RegionFilter): Topic[] {
  return scan.topics
    .filter((t) => topicIn(t, region).metrics.posts > 0)
    .sort((a, b) => topicIn(b, region).heat - topicIn(a, region).heat);
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

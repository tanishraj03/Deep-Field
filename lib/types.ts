// Shared vocabulary. If a concept is not here, it does not exist in the app.

import type { RegionCode } from "./niches";
export type { RegionCode };

/** "ALL" is the unfiltered view; the other two are where a post happened. */
export type RegionFilter = "ALL" | RegionCode;

export type SourceId =
  | "reddit" | "hackernews" | "youtube" | "news" | "wikipedia"
  | "google-trends" | "bluesky" | "mastodon";

/**
 * One conversation as it exists on its platform — a Reddit thread, an HN
 * story, a video. Every number on it was reported by the platform; nothing
 * is estimated. A number we do not have is undefined, never zero.
 */
export interface Post {
  id: string;
  source: SourceId;
  title: string;
  url: string;
  /** r/india, a channel name, a publication. */
  community: string;
  region: RegionCode;
  createdAt: string | null;
  score?: number;
  comments?: number;
  views?: number;
  /**
   * False for Reddit posts younger than ~36h read from the archive: their
   * counts have not been collected yet, so they show volume, not engagement.
   */
  measured: boolean;
  /** Position in the platform's own "hot" ranking, when we read one. */
  hotRank?: number;
  snippet?: string;
}

export type Sentiment = "positive" | "negative" | "mixed" | "neutral";

export interface ContentAngle {
  format: string;
  hook: string;
}

/** A cluster of posts that are the same conversation. */
export interface Topic {
  id: string;
  niche: string;
  title: string;
  summary: string;
  whyNow: string;
  sentiment: Sentiment;
  questions: string[];
  angles: ContentAngle[];
  postIds: string[];
  metrics: TopicMetrics;
  /** 0–100 on one scale across every niche. */
  heat: number;
  /** The same numbers counting only India's or only Global's posts — what the region filter shows. */
  byRegion: Record<RegionCode, { metrics: TopicMetrics; heat: number }>;
  /** Change against the closest topic in the previous scan; null if new. */
  heatDelta: number | null;
  isNew: boolean;
  /** "ai" when a model grouped it, "rules" when keyword overlap did. */
  groupedBy: "ai" | "rules";
}

export interface TopicMetrics {
  posts: number;
  comments: number;
  score: number;
  views: number;
  communities: number;
  /** Posts in Indian communities, for the India/Global split. */
  postsIN: number;
  postsGLOBAL: number;
  /** Posts younger than 24h — the velocity signal. */
  last24h: number;
  sources: Partial<Record<SourceId, number>>;
}

/** Per-community volume, measured by Reddit's archive. */
export interface CommunityVolume {
  name: string;
  region: RegionCode;
  /** Posts per day over the last ~2 weeks, oldest first. */
  daily: number[];
  postsWeek: number;
}

export interface SourceRun {
  source: string;
  ok: boolean;
  count: number;
  note?: string;
}

export interface NicheScan {
  niche: string;
  scannedAt: string;
  topics: Topic[];
  posts: Post[];
  communities: CommunityVolume[];
  /** Total posts across the niche's communities, per day, oldest first. */
  dailyVolume: { date: string; IN: number; GLOBAL: number }[];
  /** When community volume was last read — it changes daily, so it is reused between scans. */
  volumeAt: string | null;
  sources: SourceRun[];
  model: string | null;
  /** Why topics fell back to rules, when they did. */
  aiNote?: string;
}

/** Things that are spiking across the whole internet, not tied to a niche. */
export interface Signal {
  id: string;
  source: SourceId;
  title: string;
  url: string;
  region: RegionCode;
  /** "200K+ searches", "1.2 lakh pageviews", "540 posts today". */
  measure: string;
  value: number;
  niche: string | null;
  context?: string;
}

export interface SignalsScan {
  scannedAt: string;
  signals: Signal[];
  sources: SourceRun[];
}

/* ───────────── Explore ───────────── */

export interface ExploreSourceResult {
  source: SourceId;
  ok: boolean;
  note?: string;
  /** Total matching conversations in the window, as the source counts them. */
  total: number | null;
  /** True when `total` is a floor (the source caps its result list). */
  capped?: boolean;
  window: string;
}

export interface ExploreResult {
  query: string;
  region: RegionFilter;
  fetchedAt: string;
  sources: ExploreSourceResult[];
  /** Conversations per day by source, oldest first. */
  daily: { date: string; reddit: number; hackernews: number; news: number; youtube: number }[];
  /** Wikipedia pageviews per day, as an attention line. */
  attention: { article: string; url: string; daily: { date: string; views: number }[] } | null;
  posts: Post[];
  communities: { name: string; posts: number; region: RegionCode }[];
  regionSplit: { IN: number; GLOBAL: number };
  totals: { conversations: number; comments: number; score: number; views: number };
  links: { label: string; url: string }[];
}

export interface ExploreInsight {
  summary: string;
  threads: { title: string; detail: string }[];
  sentiment: { label: Sentiment; detail: string };
  questions: string[];
  angles: ContentAngle[];
  verdict: string;
  model: string;
}

/* ───────────── What people are saying ───────────── */

/**
 * One comment, reply or social post, as its platform reported it. Scores
 * follow the same rule as posts: a number we do not have is undefined.
 */
export interface Comment {
  id: string;
  source: SourceId;
  /** The Post this was said under; for Bluesky, the search it came from. */
  postId: string;
  author: string;
  text: string;
  url: string;
  createdAt: string | null;
  /** Upvotes or likes. Hacker News does not publish comment points. */
  score?: number;
  /** Replies the platform counted, not only the ones we kept. */
  replyCount?: number;
  /** Set on replies: the comment this answers. */
  parentId?: string;
  /** The best replies, one level deep. */
  replies: Comment[];
}

/** The comments read from one thread, or one social search. */
export interface CommentThread {
  postId: string;
  source: SourceId;
  title: string;
  url: string;
  community: string;
  region: RegionCode;
  ok: boolean;
  note?: string;
  comments: Comment[];
}

/** A comment the analyst picked because it explains why the conversation is spreading. */
export interface VoicePick {
  commentId: string;
  /** One line: what this comment reveals. Empty when ranked without AI. */
  why: string;
  role: "driver" | "pushback" | "insider" | "question" | "evidence" | "mood";
}

export interface Discussion {
  /** What was read: a scanned topic or an Explore query. */
  subject: { type: "topic"; niche: string; topicId: string; title: string } | { type: "query"; query: string; region: RegionFilter };
  fetchedAt: string;
  threads: CommentThread[];
  /** Ranked, most revealing first. */
  picks: VoicePick[];
  themes: { label: string; detail: string; commentIds: string[] }[];
  /** 1-2 sentences on what the comments say about why this is spreading. */
  takeaway: string;
  /** null when ranked by votes because no model was available. */
  model: string | null;
  note?: string;
}

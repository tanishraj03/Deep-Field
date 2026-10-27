import { completeJSON } from "@/lib/ai/client";
import { backgroundModels } from "@/lib/ai/models";
import { VOICES_SYSTEM, voicesUser } from "@/lib/ai/prompts";
import { config } from "@/lib/config";
import { cachedExplore, explore, normalizeQuery, titleMatches } from "@/lib/explore";
import { loadScan } from "@/lib/pulse/scan";
import * as hn from "@/lib/sources/hackernews";
import { errMessage } from "@/lib/sources/http";
import * as reddit from "@/lib/sources/reddit";
import { blueskyPosts } from "@/lib/sources/social";
import * as yt from "@/lib/sources/youtube";
import { store } from "@/lib/store";
import type { Comment, CommentThread, Discussion, Post, RegionFilter, SourceId, VoicePick } from "@/lib/types";
import { hash, pool, shortQuery, terms } from "@/lib/utils";
import { postsFor } from "@/lib/view";

/**
 * What people are saying: the comments under a conversation's biggest
 * threads, plus what Bluesky is posting about it, with the most revealing
 * ones picked out, the comments that explain why it is spreading, not just
 * the most upvoted.
 *
 * Read on demand rather than during scans: a niche scan already runs close to
 * the serverless time limit, and most topics are never opened.
 */

const THREADS = 6;
const CANDIDATES = 80;
const ROLES = new Set<VoicePick["role"]>(["driver", "pushback", "insider", "question", "evidence", "mood"]);

const topicKey = (niche: string, id: string) => `discussion:topic:${niche}:${id}`;
const queryKey = (q: string, region: RegionFilter) => `discussion:q:${region}:${hash(normalizeQuery(q).toLowerCase())}`;

const COMMENTABLE: Partial<Record<SourceId, (p: Post) => Promise<Comment[]>>> = {
  reddit: (p) => reddit.threadComments(p),
  hackernews: (p) => hn.storyComments(p),
  youtube: (p) => yt.videoComments(p),
};

/**
 * The threads worth reading: most discussed first, interleaved by source so
 * a topic with one big video still reads the Reddit side, and vice versa.
 */
function pickThreads(posts: Post[]): Post[] {
  const usable = posts
    .filter((p) => COMMENTABLE[p.source] && (p.source !== "youtube" || yt.hasYouTube()))
    .filter((p) => (p.comments ?? 0) > 0 || !p.measured)
    .sort((a, b) => reddit.engagement(b) - reddit.engagement(a));
  const bySource = new Map<SourceId, Post[]>();
  for (const p of usable) (bySource.get(p.source) ?? bySource.set(p.source, []).get(p.source)!).push(p);
  const out: Post[] = [];
  for (let i = 0; out.length < THREADS && i < THREADS; i++) {
    for (const list of bySource.values()) if (list[i] && out.length < THREADS) out.push(list[i]);
  }
  return out;
}

async function readThreads(posts: Post[], blueskyQuery: string | null): Promise<CommentThread[]> {
  const threads = await pool(pickThreads(posts), 3, async (p): Promise<CommentThread> => {
    const base = { postId: p.id, source: p.source, title: p.title, url: p.url, community: p.community, region: p.region };
    try {
      return { ...base, ok: true, comments: await COMMENTABLE[p.source]!(p) };
    } catch (e) {
      return { ...base, ok: false, note: errMessage(e), comments: [] };
    }
  });
  if (blueskyQuery) {
    const base = {
      postId: `bluesky:${blueskyQuery}`, source: "bluesky" as const, title: `Bluesky posts about “${blueskyQuery}”`,
      url: `https://bsky.app/search?q=${encodeURIComponent(blueskyQuery)}`, community: "Bluesky", region: "GLOBAL" as const,
    };
    try {
      threads.push({ ...base, ok: true, comments: await blueskyPosts(blueskyQuery) });
    } catch (e) {
      threads.push({ ...base, ok: false, note: errMessage(e), comments: [] });
    }
  }
  return threads;
}

/**
 * A rough "worth reading" score for ranking without a model, and for
 * choosing which comments the model sees: votes and replies on a log scale,
 * words shared with the topic, and a penalty for one-liners.
 */
function signal(c: Comment, topicTerms: Set<string>): number {
  const votes = Math.log10((c.score ?? 0) + 1) * 2;
  const talk = Math.log10((c.replyCount ?? 0) + 1) * 1.5;
  const overlap = Math.min(3, terms(c.text).filter((w) => topicTerms.has(w)).length) * 0.6;
  const length = c.text.length < 40 ? -1.5 : c.text.length > 120 ? 0.5 : 0;
  return votes + talk + overlap + length;
}

function candidates(threads: CommentThread[], topicTerms: Set<string>): Comment[] {
  // Each thread contributes its best comments and their best replies, capped
  // so one huge thread cannot crowd out the others.
  const perThread = Math.max(10, Math.ceil(CANDIDATES / Math.max(1, threads.length)));
  return threads
    .flatMap((t) => t.comments.flatMap((c) => [c, ...c.replies]).sort((a, b) => signal(b, topicTerms) - signal(a, topicTerms)).slice(0, perThread))
    .sort((a, b) => signal(b, topicTerms) - signal(a, topicTerms))
    .slice(0, CANDIDATES);
}

interface Raw {
  takeaway?: string;
  picks?: { i?: number; role?: string; why?: string }[];
  themes?: { label?: string; detail?: string; comments?: number[] }[];
}

async function rank(subject: { title: string; summary?: string; whyNow?: string }, threads: CommentThread[]) {
  const topicTerms = new Set(terms(`${subject.title} ${subject.summary ?? ""}`));
  const pool = candidates(threads, topicTerms);
  const byVotes = (): Pick<Discussion, "picks" | "themes" | "takeaway" | "model"> => ({
    picks: pool.slice(0, 10).map((c) => ({ commentId: c.id, why: "", role: "mood" })),
    themes: [], takeaway: "", model: null,
  });
  if (pool.length < 3) return { ...byVotes(), note: pool.length ? undefined : "No comments could be read for this conversation yet." };

  const slots = backgroundModels().slice(0, 3);
  if (!slots.length) return { ...byVotes(), note: "Ranked by votes and replies. Add GEMINI_API_KEY (free) to have the most revealing comments picked out." };

  let lastError: unknown;
  for (const slot of slots) {
    try {
      const { data, model } = await completeJSON<Raw>(slot.id, VOICES_SYSTEM, voicesUser(subject, threads, pool), 4000);
      const at = (i: unknown) => (typeof i === "number" && pool[i] ? pool[i] : null);
      const seen = new Set<string>();
      const picks: VoicePick[] = [];
      for (const p of data.picks ?? []) {
        const c = at(p.i);
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        picks.push({ commentId: c.id, why: String(p.why ?? ""), role: ROLES.has(p.role as VoicePick["role"]) ? p.role as VoicePick["role"] : "mood" });
      }
      if (!picks.length) throw new Error("The model picked no comments");
      const themes = (data.themes ?? [])
        .map((t) => ({
          label: String(t.label ?? ""), detail: String(t.detail ?? ""),
          commentIds: [...new Set((t.comments ?? []).map(at).filter((c): c is Comment => !!c).map((c) => c.id))],
        }))
        .filter((t) => t.label && t.commentIds.length);
      return { picks: picks.slice(0, 12), themes: themes.slice(0, 5), takeaway: String(data.takeaway ?? ""), model };
    } catch (e) { lastError = e; }
  }
  return { ...byVotes(), note: `Ranked by votes and replies: the AI read failed (${errMessage(lastError)}).` };
}

async function cached(key: string, fresh?: boolean) {
  if (fresh) return null;
  const hit = await store.get<Discussion>(key);
  return hit && Date.now() - Date.parse(hit.updatedAt) < config.scan.exploreTtlMs ? hit.value : null;
}

export async function topicDiscussion(niche: string, topicId: string, opts: { fresh?: boolean } = {}): Promise<Discussion> {
  const key = topicKey(niche, topicId);
  const hit = await cached(key, opts.fresh);
  if (hit) return hit;

  const scan = await loadScan(niche);
  const topic = scan?.topics.find((t) => t.id === topicId);
  if (!scan || !topic) throw new Error("This conversation is no longer in the latest scan.");

  const threads = await readThreads(postsFor(topic, scan, "ALL"), shortQuery(topic.title, 3) || null);
  const ranked = await rank(topic, threads);
  const out: Discussion = {
    subject: { type: "topic", niche, topicId, title: topic.title },
    fetchedAt: new Date().toISOString(),
    threads,
    ...ranked,
  };
  await store.set(key, out).catch(() => {});
  return out;
}

export async function queryDiscussion(rawQuery: string, region: RegionFilter, opts: { fresh?: boolean } = {}): Promise<Discussion> {
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) throw new Error("Type at least two characters.");
  const key = queryKey(query, region);
  const hit = await cached(key, opts.fresh);
  if (hit) return hit;

  const result = (await cachedExplore(query, region)) ?? (await explore(query, region));
  // Reddit's search also matches post bodies; threads that name the topic in
  // their title are the ones whose comments are about it.
  const named = result.posts.filter((p) => titleMatches(p.title, query));
  const threads = await readThreads(named.length >= 3 ? named : result.posts, query);
  const ranked = await rank({ title: query }, threads);
  const out: Discussion = {
    subject: { type: "query", query, region },
    fetchedAt: new Date().toISOString(),
    threads,
    ...ranked,
  };
  await store.set(key, out).catch(() => {});
  return out;
}

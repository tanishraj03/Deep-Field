import { completeJSON } from "@/lib/ai/client";
import { CLUSTER_SYSTEM, clusterUser } from "@/lib/ai/prompts";
import type { ContentAngle, Post, Sentiment } from "@/lib/types";
import { terms } from "@/lib/utils";
import { engagement } from "@/lib/sources/reddit";

/** A group of posts before metrics are computed. */
export interface Draft {
  title: string;
  summary: string;
  whyNow: string;
  sentiment: Sentiment;
  questions: string[];
  angles: ContentAngle[];
  postIds: string[];
}

const SENTIMENTS = new Set(["positive", "negative", "mixed", "neutral"]);

interface ModelTopic {
  title?: string; summary?: string; whyNow?: string; sentiment?: string;
  questions?: unknown; angles?: unknown; posts?: unknown;
}

export async function clusterWithAI(modelId: string, nicheLabel: string, posts: Post[]) {
  const { data, model } = await completeJSON<{ topics?: ModelTopic[] }>(
    modelId, CLUSTER_SYSTEM, clusterUser(nicheLabel, posts), 8000,
  );
  const used = new Set<number>();
  const drafts: Draft[] = [];
  for (const t of data.topics ?? []) {
    // Indices are checked against the list: a model citing a post that does
    // not exist would otherwise produce a topic with invented evidence.
    const idx = (Array.isArray(t.posts) ? t.posts : [])
      .map(Number)
      .filter((i) => Number.isInteger(i) && i >= 0 && i < posts.length && !used.has(i));
    if (!t.title || !idx.length) continue;
    idx.forEach((i) => used.add(i));
    drafts.push({
      title: String(t.title).trim(),
      summary: String(t.summary ?? "").trim(),
      whyNow: String(t.whyNow ?? "").trim(),
      sentiment: (SENTIMENTS.has(String(t.sentiment)) ? t.sentiment : "neutral") as Sentiment,
      questions: (Array.isArray(t.questions) ? t.questions : []).map(String).filter(Boolean).slice(0, 3),
      angles: (Array.isArray(t.angles) ? t.angles : [])
        .map((a) => ({ format: String((a as ContentAngle)?.format ?? ""), hook: String((a as ContentAngle)?.hook ?? "") }))
        .filter((a) => a.hook)
        .slice(0, 3),
      postIds: idx.map((i) => posts[i].id),
    });
  }
  return { drafts, model };
}

/**
 * The fallback when no model is available or the model fails: group posts by
 * shared distinctive words. Cruder than a model, but it only ever groups what
 * is literally there, and it never leaves the screen empty.
 */
export function clusterByRules(posts: Post[]): Draft[] {
  const docs = posts.map((p) => ({ p, words: [...new Set(terms(p.title))] }));
  const df = new Map<string, Set<number>>();
  docs.forEach((d, i) => d.words.forEach((w) => (df.get(w) ?? df.set(w, new Set()).get(w)!).add(i)));

  const candidates = [...df.entries()]
    .filter(([, set]) => set.size >= 3 && set.size <= Math.max(6, posts.length * 0.15))
    .map(([w, set]) => ({
      w, set,
      weight: [...set].reduce((a, i) => a + 1 + Math.log1p(engagement(docs[i].p)), 0),
      communities: new Set([...set].map((i) => docs[i].p.community)).size,
    }))
    .filter((c) => c.communities >= 2 || c.set.size >= 4)
    .sort((a, b) => b.weight - a.weight);

  const used = new Set<number>();
  const drafts: Draft[] = [];
  for (const c of candidates) {
    const members = [...c.set].filter((i) => !used.has(i));
    if (members.length < 3) continue;
    members.forEach((i) => used.add(i));
    const ps = members.map((i) => docs[i].p).sort((a, b) => engagement(b) - engagement(a));
    const communities = [...new Set(ps.map((p) => p.community))];
    drafts.push({
      // The lead thread's own words make a better headline than a keyword.
      title: ps[0].title.length > 90 ? `${ps[0].title.slice(0, 87)}…` : ps[0].title,
      summary: `${ps.length} threads across ${communities.slice(0, 3).join(", ")}${communities.length > 3 ? ` and ${communities.length - 3} more` : ""} are talking about “${c.w}”.`,
      whyNow: "",
      sentiment: "neutral",
      questions: ps.filter((p) => p.title.trim().endsWith("?")).slice(0, 3).map((p) => p.title),
      angles: [],
      postIds: ps.map((p) => p.id),
    });
    if (drafts.length >= 8) break;
  }

  // The biggest single threads are conversations in their own right.
  const singles = posts
    .filter((p, i) => !used.has(i) && engagement(p) > 0)
    .sort((a, b) => engagement(b) - engagement(a))
    .slice(0, Math.max(0, 12 - drafts.length));
  for (const p of singles) {
    drafts.push({
      title: p.title, summary: p.snippet ?? `Discussion in ${p.community}.`, whyNow: "",
      sentiment: "neutral", questions: p.title.trim().endsWith("?") ? [p.title] : [], angles: [], postIds: [p.id],
    });
  }
  return drafts;
}

/**
 * The model only sees the strongest few hundred posts, but a scan reads
 * thousands. Every leftover post that is plainly about one of the topics —
 * sharing at least two of its distinctive words, one of them from the topic's
 * title — joins it, so a topic's counts reflect everything read, not just the
 * sample. Words common across the whole scan ("india", "job") do not count.
 */
export function attachLeftovers(drafts: Draft[], posts: Post[]): Draft[] {
  const used = new Set(drafts.flatMap((d) => d.postIds));
  const docs = posts.map((p) => ({ p, words: new Set(terms(p.title)) }));
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.words) df.set(w, (df.get(w) ?? 0) + 1);
  const common = (w: string) => (df.get(w) ?? 0) > Math.max(12, posts.length * 0.04);

  const byId = new Map(posts.map((p) => [p.id, p]));
  const vocab = drafts.map((d) => {
    const title = new Set(terms(d.title).filter((w) => !common(w)));
    const all = new Set([...title, ...terms(d.summary), ...d.postIds.flatMap((id) => terms(byId.get(id)?.title ?? ""))].filter((w) => !common(w)));
    return { title, all };
  });

  const added = drafts.map(() => [] as string[]);
  for (const { p, words } of docs) {
    if (used.has(p.id) || RECURRING_TITLE.test(p.title)) continue;
    const distinct = [...words].filter((w) => !common(w));
    if (distinct.length < 2) continue;
    let best = -1, bestScore = 0;
    vocab.forEach((v, i) => {
      const hits = distinct.filter((w) => v.all.has(w));
      if (hits.length < 2 || !hits.some((w) => v.title.has(w))) return;
      const score = hits.length / distinct.length;
      if (score >= 0.34 && score > bestScore) { best = i; bestScore = score; }
    });
    if (best >= 0 && added[best].length < 60) added[best].push(p.id);
  }
  return drafts.map((d, i) => (added[i].length ? { ...d, postIds: [...d.postIds, ...added[i]] } : d));
}

const RECURRING_TITLE = /\b(daily|weekly|monthly)\b.*\b(thread|megathread)\b|\bmega ?thread\b/i;

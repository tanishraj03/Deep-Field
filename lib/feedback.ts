import { nicheLabel } from "@/lib/niches";
import { callOf } from "@/lib/pulse/score";
import { store } from "@/lib/store";
import type { NicheScan, Topic } from "@/lib/types";

/**
 * What creators tell DeepField back, and what it learns from it.
 *
 * Each person has one document, fb:<uid>: their verdict votes ("is this call
 * right?") and the topics they made content on, with how each did against
 * their usual. Learning reads every person's document, tallies it, and turns
 * it into small, capped nudges to the verdict per niche, only once there are
 * enough results to mean something. The scores themselves never change; the
 * nudge is listed among the verdict's reasons so it is never hidden.
 */

import type { Call, Made, Outcome, TopicRef, UserFeedback, Vote } from "./feedback-shared";

export { OUTCOMES, type Call, type Made, type Outcome, type TopicRef, type UserFeedback, type Vote } from "./feedback-shared";

const EMPTY: UserFeedback = { votes: {}, made: [] };
const fbKey = (uid: string) => `fb:${uid}`;
export const topicKey = (t: Pick<Topic, "niche" | "id">) => `${t.niche}:${t.id}`;

/** How good an outcome was, against the creator's own usual (0.5). */
const VALUE: Record<Outcome, number> = { below: 0, usual: 0.5, above: 1, viral: 1.5 };
const isHit = (o: Outcome) => o === "above" || o === "viral";

export function refOf(t: Topic): TopicRef {
  return { key: topicKey(t), niche: t.niche, title: t.title, call: t.verdict.call, score: t.verdict.score, heat: t.heat, virality: t.virality };
}

export async function getFeedback(uid: string): Promise<UserFeedback> {
  const v = (await store.get<UserFeedback>(fbKey(uid)))?.value;
  return { votes: v?.votes ?? {}, made: v?.made ?? [] };
}

async function update(uid: string, fn: (f: UserFeedback) => UserFeedback): Promise<UserFeedback> {
  const next = fn(await getFeedback(uid));
  await store.set(fbKey(uid), next);
  learningCache = null;
  return next;
}

export const vote = (uid: string, topic: TopicRef, v: 1 | -1 | 0) => update(uid, (f) => {
  const votes = { ...f.votes };
  if (v === 0) delete votes[topic.key];
  else votes[topic.key] = { topic, vote: v, at: new Date().toISOString() };
  return { ...f, votes };
});

export const markMade = (uid: string, topic: TopicRef, format: string | null, url: string | null) => update(uid, (f) => {
  if (f.made.some((m) => m.topic.key === topic.key)) return f;
  const made: Made = { id: crypto.randomUUID(), topic, madeAt: new Date().toISOString(), format, url, outcome: null };
  return { ...f, made: [made, ...f.made].slice(0, 300) };
});

export const reportOutcome = (uid: string, id: string, result: Outcome, views: number | null, url: string | null) => update(uid, (f) => ({
  ...f,
  made: f.made.map((m) => (m.id === id
    ? { ...m, url: url ?? m.url, outcome: { result, views, reportedAt: new Date().toISOString() } }
    : m)),
}));

export const unmake = (uid: string, id: string) => update(uid, (f) => ({ ...f, made: f.made.filter((m) => m.id !== id) }));

/* ───────────── learning ───────────── */

interface CallStats { made: number; reported: number; hits: number; value: number; up: number; down: number }
const emptyCall = (): CallStats => ({ made: 0, reported: 0, hits: 0, value: 0, up: 0, down: 0 });

export interface NicheLearning {
  /** Points added to (or taken from) every verdict score in the niche. */
  bias: number;
  reasons: string[];
  reported: number;
  votes: number;
}

export interface Learning {
  at: string;
  people: number;
  votes: number;
  made: number;
  reported: number;
  byCall: Record<Call, CallStats>;
  byNiche: Record<string, NicheLearning>;
  /** Per topic: who agreed with its call, who didn't, and how many made it. */
  tally: Record<string, { up: number; down: number; made: number }>;
}

/** Nothing is learned from fewer results than this. */
export const MIN_RESULTS = 5;
export const MIN_VOTES = 6;
const MAX_BIAS = 7;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Tally everyone's feedback into hit rates by call and a nudge per niche.
 *
 *  - Results: when creators who made topics in a niche report doing better
 *    than their usual, its verdicts lean up; worse, they lean down. Measured
 *    against "about my usual", so the scale is each creator's own.
 *  - Votes: when most people say a niche's "Make now" calls are wrong, they
 *    lean down; when most say its "Skip" calls are wrong, they lean up.
 */
export function learnFrom(all: UserFeedback[]): Omit<Learning, "at"> {
  const byCall: Record<Call, CallStats> = { make: emptyCall(), test: emptyCall(), skip: emptyCall() };
  const niche = new Map<string, { value: number; reported: number; calls: Record<Call, { up: number; down: number }> }>();
  const tally: Learning["tally"] = {};
  const nicheOf = (id: string) => {
    let n = niche.get(id);
    if (!n) niche.set(id, n = { value: 0, reported: 0, calls: { make: { up: 0, down: 0 }, test: { up: 0, down: 0 }, skip: { up: 0, down: 0 } } });
    return n;
  };
  let votes = 0, made = 0, reported = 0;

  for (const f of all) {
    for (const v of Object.values(f.votes)) {
      votes++;
      const c = byCall[v.topic.call];
      if (v.vote > 0) c.up++; else c.down++;
      const n = nicheOf(v.topic.niche).calls[v.topic.call];
      if (v.vote > 0) n.up++; else n.down++;
      const t = (tally[v.topic.key] ??= { up: 0, down: 0, made: 0 });
      if (v.vote > 0) t.up++; else t.down++;
    }
    for (const m of f.made) {
      made++;
      byCall[m.topic.call].made++;
      (tally[m.topic.key] ??= { up: 0, down: 0, made: 0 }).made++;
      if (!m.outcome) continue;
      reported++;
      const c = byCall[m.topic.call];
      c.reported++;
      c.value += VALUE[m.outcome.result];
      if (isHit(m.outcome.result)) c.hits++;
      const n = nicheOf(m.topic.niche);
      n.reported++;
      n.value += VALUE[m.outcome.result];
    }
  }
  for (const c of Object.values(byCall)) c.value = c.reported ? c.value / c.reported : 0;

  const byNiche: Record<string, NicheLearning> = {};
  for (const [id, n] of niche) {
    const label = nicheLabel(id);
    const reasons: string[] = [];
    let bias = 0;
    if (n.reported >= MIN_RESULTS) {
      const avg = n.value / n.reported;
      const b = Math.round(clamp((avg - 0.5) * 10, -5, 5));
      if (b) {
        bias += b;
        reasons.push(`Creators' results in ${label}: ${b > 0 ? "better" : "worse"} than their usual across ${n.reported} posts`);
      }
    }
    const v = n.calls;
    const makeVotes = v.make.up + v.make.down;
    if (makeVotes >= MIN_VOTES && v.make.down / makeVotes > 0.6) {
      bias -= 3;
      reasons.push(`Creators disagreed with most "Make now" calls in ${label} (${v.make.down} of ${makeVotes})`);
    }
    const skipVotes = v.skip.up + v.skip.down;
    if (skipVotes >= MIN_VOTES && v.skip.down / skipVotes > 0.6) {
      bias += 3;
      reasons.push(`Creators disagreed with most "Skip" calls in ${label} (${v.skip.down} of ${skipVotes})`);
    }
    byNiche[id] = {
      bias: clamp(bias, -MAX_BIAS, MAX_BIAS),
      reasons,
      reported: n.reported,
      votes: Object.values(v).reduce((a, c) => a + c.up + c.down, 0),
    };
  }

  return { people: all.length, votes, made, reported, byCall, byNiche, tally };
}

let learningCache: { at: number; value: Learning } | null = null;
const LEARNING_MS = 5 * 60_000;

/** Everyone's feedback, tallied. Re-read at most every five minutes, or after any new feedback here. */
export async function learning(): Promise<Learning> {
  if (learningCache && Date.now() - learningCache.at < LEARNING_MS) return learningCache.value;
  const docs = await store.list<UserFeedback>("fb:").catch(() => []);
  const value = { at: new Date().toISOString(), ...learnFrom(docs.map((d) => ({ ...EMPTY, ...d.value }))) };
  learningCache = { at: Date.now(), value };
  return value;
}

/** A verdict with its niche's learned nudge applied, and the reason listed first. */
function nudged(t: Topic, l: NicheLearning | undefined): Topic {
  if (!l?.bias || !t.verdict) return t;
  const score = clamp(t.verdict.score + l.bias, 0, 100);
  return { ...t, verdict: { call: callOf(score), score, reasons: [l.reasons[0], ...t.verdict.reasons].slice(0, 4) } };
}

/** Apply what has been learned to scans as they are read. Cheap: one pass, no I/O. */
export function applyLearning(scans: NicheScan[], l: Learning): NicheScan[] {
  if (!Object.values(l.byNiche).some((n) => n.bias)) return scans;
  return scans.map((s) => ({ ...s, topics: s.topics.map((t) => nudged(t, l.byNiche[t.niche])) }));
}

/** For read paths: never let feedback trouble take a page down. */
export async function learningOrNull(): Promise<Learning | null> {
  return learning().catch(() => null);
}

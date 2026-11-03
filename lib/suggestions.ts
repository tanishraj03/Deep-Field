import { NICHE_BY_ID, type Niche, type RegionCode } from "@/lib/niches";
import * as arctic from "@/lib/sources/arctic";
import { store } from "@/lib/store";

/**
 * Communities people suggest for a niche. Each is checked against Reddit's
 * archive when suggested (it must exist, be safe for work and actually
 * post), then waits for the admin. An approved one joins that niche's
 * scans from the next scan on, read lightly like the rest of its long tail.
 *
 *   suggest:<niche>:<sub>   one suggestion and its status
 *   communities:approved    { [niche]: { IN: [...], GLOBAL: [...] } }
 */

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface Suggestion {
  niche: string;
  sub: string;
  region: RegionCode;
  why: string | null;
  by: { uid: string; username: string | null };
  at: string;
  subscribers: number;
  postsWeek: number;
  description: string;
  status: SuggestionStatus;
  decidedAt: string | null;
}

type Approved = Record<string, Partial<Record<RegionCode, string[]>>>;
const APPROVED_KEY = "communities:approved";
const key = (niche: string, sub: string) => `suggest:${niche}:${sub.toLowerCase()}`;

/** Fewer subscribers or weekly posts than this and a community adds nothing to a scan. */
const MIN_SUBSCRIBERS = 1000;
const MIN_POSTS_WEEK = 7;

const tracked = (n: Niche) => new Set([...n.subreddits.IN, ...n.subreddits.GLOBAL].map((s) => s.toLowerCase()));

export async function suggest(input: { niche: string; sub: string; region: RegionCode; why: string | null; uid: string; username: string | null }): Promise<Suggestion> {
  const niche = NICHE_BY_ID.get(input.niche);
  if (!niche) throw new Error("Pick a niche.");
  const name = input.sub.trim().replace(/^(https?:\/\/)?(www\.|old\.)?reddit\.com\//i, "").replace(/^\/?r\//i, "").replace(/\/.*$/, "");
  if (!/^[A-Za-z0-9_]{2,21}$/.test(name)) throw new Error("That doesn't look like a subreddit name. Try something like r/IndiaInvestments.");

  const approved = await approvedCommunities();
  if (tracked(niche).has(name.toLowerCase()) || (approved[niche.id]?.[input.region] ?? []).some((s) => s.toLowerCase() === name.toLowerCase())) {
    throw new Error(`r/${name} is already read for ${niche.label}.`);
  }
  const existing = (await store.get<Suggestion>(key(niche.id, name)))?.value;
  if (existing?.status === "pending") throw new Error(`r/${name} has already been suggested for ${niche.label} and is waiting for review.`);
  if (existing?.status === "rejected") throw new Error(`r/${name} was reviewed for ${niche.label} and not added.`);

  const info = await arctic.subredditInfo(name).catch(() => null);
  if (!info) throw new Error(`Couldn't find r/${name}. Check the spelling, or it may be private or banned.`);
  if (info.nsfw) throw new Error(`r/${info.name} is marked NSFW, so DeepField can't read it.`);
  if (info.subscribers < MIN_SUBSCRIBERS) throw new Error(`r/${info.name} has under ${MIN_SUBSCRIBERS.toLocaleString("en-US")} members, too small to add much yet.`);
  const daily = await arctic.dailyPosts(info.name, 7).catch(() => []);
  const postsWeek = daily.slice(-7).reduce((a, d) => a + d.value, 0);
  if (daily.length && postsWeek < MIN_POSTS_WEEK) throw new Error(`r/${info.name} posted only ${postsWeek} times this week, too quiet to add yet.`);

  const s: Suggestion = {
    niche: niche.id, sub: info.name, region: input.region, why: input.why?.trim().slice(0, 280) || null,
    by: { uid: input.uid, username: input.username }, at: new Date().toISOString(),
    subscribers: info.subscribers, postsWeek, description: info.description,
    status: "pending", decidedAt: null,
  };
  await store.set(key(niche.id, info.name), s);
  return s;
}

export async function allSuggestions(): Promise<Suggestion[]> {
  const docs = await store.list<Suggestion>("suggest:");
  return docs.map((d) => d.value).sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || b.at.localeCompare(a.at));
}

export async function approvedCommunities(): Promise<Approved> {
  return (await store.get<Approved>(APPROVED_KEY).catch(() => null))?.value ?? {};
}

/** Approve or reject. Approving adds it to the niche's scans; rejecting takes it out again if it was in. */
export async function decide(niche: string, sub: string, status: "approved" | "rejected"): Promise<Suggestion> {
  const k = key(niche, sub);
  const s = (await store.get<Suggestion>(k))?.value;
  if (!s) throw new Error("That suggestion no longer exists.");
  const approved = await approvedCommunities();
  const list = new Set(approved[s.niche]?.[s.region] ?? []);
  if (status === "approved") list.add(s.sub); else list.delete(s.sub);
  await store.set(APPROVED_KEY, { ...approved, [s.niche]: { ...approved[s.niche], [s.region]: [...list] } });
  const next = { ...s, status, decidedAt: new Date().toISOString() };
  await store.set(k, next);
  return next;
}

/** A niche with its approved suggestions added to the end of its long tail. */
export function withApproved(n: Niche, approved: Approved): Niche {
  const extra = approved[n.id];
  if (!extra) return n;
  const have = tracked(n);
  const add = (r: RegionCode) => (extra[r] ?? []).filter((s) => !have.has(s.toLowerCase()));
  return { ...n, subreddits: { IN: [...n.subreddits.IN, ...add("IN")], GLOBAL: [...n.subreddits.GLOBAL, ...add("GLOBAL")] } };
}

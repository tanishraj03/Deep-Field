import { createHash } from "node:crypto";
import { after } from "next/server";
import { config } from "@/lib/config";
import { store } from "@/lib/store";

/**
 * What creators are researching: Explore searches, counted without names.
 *
 * One document per search phrase per day, research:<date>:<phrase hash>,
 * holding the phrase and a one-way fingerprint of each person who searched
 * it, so the same person searching ten times counts once. Nobody, the admin
 * included, can see who searched what. A phrase is only shown once at least
 * MIN_PEOPLE different people searched it, so a single person's search
 * never surfaces.
 */

export const MIN_PEOPLE = 2;
const DAYS = 7;
const RECENT_DAYS = 3;

interface DayDoc { q: string; people: string[] }

export interface Researched {
  query: string;
  /** Different people who searched it in the last three days. */
  people: number;
  /** More people this time than in the four days before. */
  rising: boolean;
}

/** "Sam Altman  RAM " → "sam altman ram". */
export const normalize = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 80);

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const digest = (s: string, n: number) => createHash("sha256").update(s).digest("hex").slice(0, n);
/** Salted with AUTH_SECRET so a stored fingerprint can't be matched back to an account id. */
const fingerprint = (uid: string) => digest(`research:${config.auth.secret}:${uid}`, 12);

/** Count one Explore search. After the response; never throws. */
export function recordResearch(uid: string, query: string): void {
  const n = normalize(query);
  if (n.length < 2) return;
  after(async () => {
    const key = `research:${day(Date.now())}:${digest(n, 16)}`;
    const doc = (await store.get<DayDoc>(key).catch(() => null))?.value;
    const who = fingerprint(uid);
    if (doc?.people.includes(who)) return;
    await store.set<DayDoc>(key, { q: doc?.q ?? query.trim().slice(0, 80), people: [...(doc?.people ?? []), who] }).catch(() => {});
  });
}

let cache: { at: number; value: Researched[] } | null = null;

/** The phrases most people researched lately, busiest first. Cached for five minutes. */
export async function researchTrends(limit = 12): Promise<Researched[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  const now = Date.now();
  const dates = Array.from({ length: DAYS }, (_, i) => day(now - i * 86_400_000));
  const recent = new Set(dates.slice(0, RECENT_DAYS));
  const docs = (await Promise.all(dates.map((d) => store.list<DayDoc>(`research:${d}:`).catch(() => [])))).flat();

  const byPhrase = new Map<string, { q: string; recent: Set<string>; before: Set<string> }>();
  for (const d of docs) {
    const date = d.key.split(":")[1];
    const n = normalize(d.value.q);
    const e = byPhrase.get(n) ?? { q: d.value.q, recent: new Set<string>(), before: new Set<string>() };
    for (const p of d.value.people) (recent.has(date) ? e.recent : e.before).add(p);
    byPhrase.set(n, e);
  }
  const value = [...byPhrase.values()]
    .filter((e) => e.recent.size >= MIN_PEOPLE)
    .map((e) => ({ query: e.q, people: e.recent.size, rising: e.recent.size > e.before.size }))
    .sort((a, b) => b.people - a.people || Number(b.rising) - Number(a.rising))
    .slice(0, limit);
  cache = { at: now, value };
  return value;
}

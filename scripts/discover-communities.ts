/**
 * Find ~100 active, relevant communities per niche and write them to
 * lib/communities.json, which lib/niches.ts merges into each niche.
 *
 *   npx tsx scripts/discover-communities.ts            # all niches
 *   npx tsx scripts/discover-communities.ts fitness    # one niche
 *
 * Candidates are the hand-written lists in community-candidates.ts, the
 * niche's existing communities, and archive prefix searches. Each is checked
 * against the Arctic Shift archive — exists, not NSFW, subscribers, posts in
 * the last 7 days — and the most active are kept, India first up to a quota.
 *
 * Gentle on the archive: two requests in flight, a pause between each, and a
 * backoff whenever it answers 429 or "slow down". Every answer is cached in
 * .data/discover-cache.json, so an interrupted run resumes where it stopped.
 */
import "./load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NICHES, curatedSubreddits, isIndianCommunity } from "@/lib/niches";
import { CANDIDATES } from "./community-candidates";

const BASE = "https://arctic-shift.photon-reddit.com/api";
const CACHE = ".data/discover-cache.json";
const OUT = "lib/communities.json";
const PER_NICHE = 100;
const INDIA_QUOTA = 35;
const MIN_WEEKLY = 7;
const MIN_SUBSCRIBERS = 3000;

interface Meta { name: string; subscribers: number; nsfw: boolean; description: string }
interface CacheShape { meta: Record<string, Meta | null>; weekly: Record<string, number>; prefix: Record<string, Meta[]> }

const cache: CacheShape = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { meta: {}, weekly: {}, prefix: {} };
let dirty = 0;
const save = (force = false) => {
  if (!force && ++dirty % 25) return;
  mkdirSync(".data", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

/** One archive request, paced and retried. */
async function call<T>(path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(300);
    calls++;
    try {
      const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": "deepfield/2.0 (community discovery; personal research)" }, signal: AbortSignal.timeout(25_000) });
      if (res.status === 429) { await sleep(Number(res.headers.get("x-ratelimit-reset") ?? 10) * 1000 + 500); continue; }
      const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
      if (json.error && /timeout|slow down/i.test(json.error)) { await sleep(3000 * (attempt + 1)); continue; }
      if (!res.ok || json.error) return null;
      return json.data ?? null;
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

const FIELDS = "display_name,subscribers,over18,public_description";
interface RawSub { display_name: string; subscribers: number | null; over18: boolean; public_description: string | null }
const toMeta = (s: RawSub): Meta => ({ name: s.display_name, subscribers: s.subscribers ?? 0, nsfw: s.over18, description: (s.public_description ?? "").slice(0, 200) });

async function meta(name: string): Promise<Meta | null> {
  const key = name.toLowerCase();
  if (key in cache.meta) return cache.meta[key];
  const d = await call<RawSub[]>(`/subreddits/search?subreddit=${encodeURIComponent(name)}&limit=1&fields=${FIELDS}`);
  const m = d?.[0] && d[0].display_name.toLowerCase() === key ? toMeta(d[0]) : null;
  cache.meta[key] = m;
  save();
  return m;
}

async function weekly(name: string): Promise<number> {
  const key = name.toLowerCase();
  if (key in cache.weekly) return cache.weekly[key];
  const d = await call<{ date: number; value: number }[]>(`/time_series?key=${encodeURIComponent(`r/${name}/posts/count`)}&precision=day&after=8d`);
  const n = (d ?? []).slice(-7).reduce((a, x) => a + x.value, 0);
  cache.weekly[key] = n;
  save();
  return n;
}

async function prefix(term: string): Promise<Meta[]> {
  if (cache.prefix[term]) return cache.prefix[term];
  const d = await call<RawSub[]>(`/subreddits/search?subreddit_prefix=${encodeURIComponent(term)}&limit=50&fields=${FIELDS}`);
  const list = (d ?? []).map(toMeta);
  cache.prefix[term] = list;
  for (const m of list) cache.meta[m.name.toLowerCase()] = m;
  save();
  return list;
}

/** Two at a time, in order. */
async function pool<T, R>(items: T[], fn: (t: T) => Promise<R>, limit = 2): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const INDIA_TEXT = /\b(india|indian|desi|bharat|hindi)\b/i;
/** Prefix matches whose description passes but whose subject does not ("trading" cards, "work" boots). */
const EXCLUDE = new Set(["tradingcards", "tradingcardcommunity", "workboots"]);
/** Communities that are adult in all but flag, whatever niche they match. */
const ADULT = /(feet|thicc|babes|gurls|gonewild|nsfw|onlyfans|lewd|hentai|porn|bikini|booty|fetish|nude)/i;
/** Prefix matches in another language's community (r/FitnessDE, r/MemesBR); the audience is India and English-global. */
const OTHER_LANGUAGE = /(br|brasil|brazil|ita|italia|italiani|francais|france|fr|de|deutsch|espanol|españa|argentina|portugal|mexico|hungary|tr|nl|polska|pl|ph|philippines)$/i;

async function discover(nicheId: string) {
  const niche = NICHES.find((n) => n.id === nicheId)!;
  const c = CANDIDATES[nicheId];
  // Keyed by lowercase: Reddit names are case-insensitive.
  const named = new Map<string, { name: string; hint: "IN" | "GLOBAL"; found?: boolean }>();
  const add = (name: string, hint: "IN" | "GLOBAL", found = false) => { if (name && !named.has(name.toLowerCase())) named.set(name.toLowerCase(), { name, hint, found }); };
  // A prefix match only counts if its own description talks about the niche:
  // "ai" also prefixes r/AITAH and r/airsoft, "stock" prefixes r/stockholm.
  const terms = [...new Set([...niche.keywords, ...(c?.prefixes ?? "").split(/\s+/), ...niche.label.toLowerCase().split(/[^a-z]+/)].filter((w) => w.length >= 2))];
  // Whole words (plurals allowed): "ai" must not match "airsoft".
  const aboutNiche = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})s?\\b`, "i");
  // Start from the hand-picked lists only: niche.subreddits already includes
  // the last discovery, which would carry its mistakes past the filters.
  const curated = curatedSubreddits(nicheId);
  for (const s of [...curated.IN, ...(c?.IN.split(/\s+/) ?? [])]) add(s, "IN");
  for (const s of [...curated.GLOBAL, ...(c?.GLOBAL.split(/\s+/) ?? [])]) add(s, "GLOBAL");

  // Prefix searches return metadata already; keep only sizeable, safe ones.
  for (const term of (c?.prefixes ?? "").split(/\s+/).filter(Boolean)) {
    for (const m of await prefix(term)) {
      if (m.nsfw || m.subscribers < 5_000 || OTHER_LANGUAGE.test(m.name) || !aboutNiche.test(m.description)) continue;
      add(m.name, "GLOBAL", true);
    }
  }

  const checked = await pool([...named.values()], async ({ name, hint }) => {
    const m = await meta(name);
    if (!m || m.nsfw || m.subscribers < MIN_SUBSCRIBERS || EXCLUDE.has(m.name.toLowerCase()) || ADULT.test(`${m.name} ${m.description}`)) return null;
    const posts = await weekly(m.name);
    const india = hint === "IN" || isIndianCommunity(m.name) || INDIA_TEXT.test(m.description);
    return { name: m.name, region: india ? "IN" as const : "GLOBAL" as const, weekly: posts, subscribers: m.subscribers };
  });

  const seen = new Set<string>();
  const active = checked.filter((x): x is NonNullable<typeof x> => !!x && x.weekly >= MIN_WEEKLY)
    .filter((x) => !seen.has(x.name.toLowerCase()) && seen.add(x.name.toLowerCase()))
    .sort((a, b) => b.weekly - a.weekly);
  const IN = active.filter((x) => x.region === "IN").slice(0, INDIA_QUOTA);
  const GLOBAL = active.filter((x) => x.region === "GLOBAL").slice(0, PER_NICHE - IN.length);
  console.log(`${nicheId.padEnd(14)} candidates ${named.size} · active ${active.length} · kept ${IN.length} India + ${GLOBAL.length} global · ${calls} calls so far`);
  // Names only, busiest first: this file ships to the browser with the niche
  // list, and the counts behind the order stay in the discovery cache.
  return { IN: IN.map((x) => x.name), GLOBAL: GLOBAL.map((x) => x.name) };
}

async function main() {
  const only = process.argv[2];
  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { niches: {} };
  const ids = only ? [only] : NICHES.map((n) => n.id);
  for (const id of ids) {
    existing.niches[id] = await discover(id);
    existing.generatedAt = new Date().toISOString();
    writeFileSync(OUT, `${JSON.stringify(existing, null, 1)}\n`);
  }
  save(true);
  console.log(`done · ${calls} archive calls`);
}

main();

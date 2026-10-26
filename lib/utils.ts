import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stable id from any string. Deterministic across runs — dedup depends on it. */
export function hash(input: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const TRACKING = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|igshid|si|s|__twitter)/i;

/** Strip the noise that makes the same article look like four different URLs. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.protocol = "https:";
    u.hostname = u.hostname.replace(/^www\./, "").toLowerCase();
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    u.search = u.searchParams.toString() ? `?${u.searchParams.toString()}` : "";
    return u.toString();
  } catch {
    return raw.trim();
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c",
  ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", eacute: "\u00e9", nbsp2: " ",
};

/** Decode numeric and named HTML entities. */
function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, dec, hex, name) => {
    if (dec) { const c = Number(dec); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
    if (hex) { const c = parseInt(hex, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
    return NAMED_ENTITIES[String(name).toLowerCase()] ?? m;
  });
}

/**
 * Markup out, readable text in.
 *
 * Entities are decoded on both sides of tag-stripping: feeds commonly escape
 * their markup once (so tags only appear after a decode) and titles carry
 * numeric entities like &#8217; that rendered literally in the interface.
 */
export function stripHtml(s: string): string {
  const once = decodeEntities(s);
  return decodeEntities(
    once
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

export function daysAgo(iso: string | null): number {
  if (!iso) return 999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 999;
  return (Date.now() - t) / 86_400_000;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "time unknown";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return "time unknown";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.round(hrs / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

export function istClock(d = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  }).format(d);
}

export function istDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(d);
}

export function todayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

export function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

/** Run promises with a concurrency ceiling. Keeps us polite to every host. */
export async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Per-host request spacing.
 *
 * config.ingestion.minDelayPerHostMs has always documented "we read public
 * feeds at a walking pace", but nothing read it — the collector fired six
 * concurrent requests and hosts that group several feeds under one domain got
 * them all at once. Reddit answered that with HTTP 429 for five sources every
 * run. Requests to the same host now queue behind each other; different hosts
 * are still fetched in parallel.
 */
const hostQueue = new Map<string, Promise<unknown>>();

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

export async function fetchWithTimeout(
  url: string,
  ms: number,
  init?: RequestInit & { minDelayMs?: number },
) {
  const { minDelayMs, ...rest } = init ?? {};
  const host = hostOf(url);
  const gap = minDelayMs ?? 0;

  const run = async (): Promise<Response> => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      return await fetch(url, { ...rest, signal: ctl.signal });
    } finally {
      clearTimeout(t);
    }
  };

  if (gap <= 0) return run();

  // Chain onto whatever is already queued for this host, then wait the gap.
  const prior = hostQueue.get(host) ?? Promise.resolve();
  const mine = prior
    .catch(() => undefined)
    .then(() => new Promise((r) => setTimeout(r, gap)))
    .then(run);
  // Keep the chain alive even when a link rejects, so one failure does not
  // release every queued request at once.
  hostQueue.set(host, mine.catch(() => undefined));
  return mine;
}

/** 1234 → "1.2K", 2_300_000 → "2.3M". */
export function compact(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

const STOP = new Set(("a an and are as at be been but by can could did do does for from had has have how i if in into is it its just " +
  "me my no not of on or our out so than that the their them then there these they this to too up us was we were what when where " +
  "which who why will with would you your about after again all also any am because before being both each few more most new now " +
  "only other over same she he his her some such very get got one two like dont im ive cant wont people anyone someone something " +
  "should help need any thoughts advice question vs best today week year years really much many still even make made going want").split(" "));

/** Lowercased content words, for overlap matching. */
export function terms(text: string): string[] {
  return text.toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9ऀ-ॿ ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

/** A topic title cut down to a search query: its first few content words. */
export function shortQuery(title: string, words = 4): string {
  return title.replace(/[“”"'’:—–\-|?!.,()]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase())).slice(0, words).join(" ");
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

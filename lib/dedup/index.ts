import { SOURCE_TIER, type RawItem, type SourceRef } from "@/lib/types";
import { hash } from "@/lib/utils";

export interface Cluster {
  id: string;
  primary: RawItem;
  members: RawItem[];
  sources: SourceRef[];
  firstSeenAt: string;
  lastUpdatedAt: string;
}

const STOP = new Set(["the","a","an","and","or","to","of","in","on","for","with","at","by","from",
  "is","are","its","it","as","that","this","after","over","into","raises","raised","funding","round",
  "crore","million","billion","says","said","new","up","amid","how","why","what"]);

export function normaliseTitle(t: string): string {
  return t.toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(t: string): Set<string> {
  return new Set(normaliseTitle(t).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Character trigram similarity. Catches "Zepto raises $150M" vs "Zepto bags $150 Mn". */
function trigramSim(a: string, b: string): number {
  const g = (s: string) => {
    const set = new Set<string>();
    const p = ` ${normaliseTitle(s)} `;
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3));
    return set;
  };
  return jaccard(g(a), g(b));
}

/**
 * The pieces of a headline that identify a *company*: capitalised runs that
 * are not sentence-initial filler. Deliberately conservative — a wrong company
 * match merges two unrelated events, which is worse than showing two cards.
 */
/** Desk furniture and section labels that read like names but are not companies. */
const NOT_A_COMPANY = new Set([
  "briefing", "playbook", "report", "roundup", "round-up", "digest", "newsletter",
  "podcast", "interview", "opinion", "explainer", "future", "media", "weekly",
  "monthly", "daily", "exclusive", "breaking", "update", "watch", "column",
  "analysis", "guide", "tips", "lessons", "trends", "news",
  // Generic plurals: a headline about "brands" or "founders" names no company.
  "brands", "companies", "startups", "founders", "creators", "marketers",
  "agencies", "advertisers", "publishers", "influencers", "retailers", "platforms",
]);

/** Verbs a headline puts immediately after the company it is about. */
const ACTION_RE = new RegExp(
  "\\b(raises?|raised|bags?|secures?|closes?|nets?|lands?|picks? up|mops? up" +
  "|acquires?|acquired|buys?|sells?|merges?|invests?" +
  "|appoints?|names?|onboards?|hires?|elevates?|promotes?|taps?|signs?" +
  "|partners?|teams? up|collaborates?|ties? up" +
  "|launches?|unveils?|introduces?|announces?|expands?|enters?|rolls? out" +
  "|integrates?|adds?|debuts?|rebrands?" +
  "|builds?|built|turns?|shifts?|moves?|opens?|scales?" +
  // Movement and performance verbs — headlines about a company's numbers are
  // still headlines about that company.
  "|slips?|falls?|rises?|climbs?|drops?|posts?|reports?|sees?|eyes?|plans?" +
  "|targets?|hits?|crosses?|doubles?|triples?|cuts?|raises stake|files?|bets?|backs?)\\b",
  "i",
);

/** Leading qualifiers that describe a company rather than name it. */
const LEAD_QUALIFIER_RE =
  /^(?:(?:Exclusive|Breaking|Update|Report|ICYMI|Opinion|Analysis)\s*[:—-]\s*)|^(?:[A-Z][\w.]*(?:[- ][A-Z]?[\w.]*)*?-based\s+)|^(?:The|A|An|How|Why|What|When|Where|Which)\s+/i;

function looksLikeName(name: string): boolean {
  const words = name.split(/\s+/);
  if (words.length === 0 || words.length > 4) return false;
  if (name.length < 2) return false;
  if (STOP.has(name.toLowerCase())) return false;
  // Any section-label word disqualifies the whole phrase — "Media Buying
  // Briefing" and "Future of TV Briefing" are columns, not companies.
  if (words.some((w) => NOT_A_COMPANY.has(w.toLowerCase().replace(/[^a-z-]/g, "")))) return false;
  // Must not be entirely ordinary words: "The Paid Social" is a headline, not a firm.
  if (words.every((w) => STOP.has(w.toLowerCase()))) return false;
  return true;
}

/**
 * The company a headline is about.
 *
 * Previously this took the first run of capitalised words, which produced
 * "Stockholm-based Fluencify", "How Orbitkey Built", "Media Buying Briefing"
 * and "The Paid Social" — a location glued to a name, a name glued to a verb,
 * and two section labels that are not companies at all.
 *
 * Headlines put the subject immediately before the verb, so the verb is found
 * first and the capitalised run in front of it is read as the name. Only if
 * there is no verb does it fall back to the leading run. Anything that fails
 * validation returns null, because no name is more useful than a wrong one.
 */
export function guessCompany(title: string): string | null {
  let cleaned = title.trim();
  // Strip stacked qualifiers: "Exclusive: Stockholm-based Fluencify …".
  for (let i = 0; i < 3; i++) {
    const stripped = cleaned.replace(LEAD_QUALIFIER_RE, "");
    if (stripped === cleaned) break;
    cleaned = stripped.trim();
  }

  const verb = cleaned.match(ACTION_RE);
  if (verb && verb.index !== undefined && verb.index > 0) {
    // "Balaji Telefilms and YouTube partner …" names two companies; the item is
    // filed under the first, which is the one the headline leads with.
    const before = cleaned.slice(0, verb.index)
      .split(/\s+and\s+/i)[0]   // not "&": it belongs inside names like Procter & Gamble
      .trim().replace(/[,:;–—-]+$/, "").trim();
    const run = before.match(/([A-Z][A-Za-z0-9&.'’-]*(?:\s+(?:[A-Z][A-Za-z0-9&.'’-]*|of|&)){0,3})$/);
    if (run) {
      const name = run[1].trim().replace(/\s+(of|and|&)$/i, "").trim();
      if (looksLikeName(name)) return name;
    }
  }

  // A headline with no action verb is a column, an essay or a listicle — it is
  // not reporting that a company did something, so it names no company.
  if (!verb) return null;

  const lead = cleaned.match(/^([A-Z][A-Za-z0-9&.'’-]*(?:\s+[A-Z][A-Za-z0-9&.'’-]*){0,2})/);
  if (!lead) return null;
  const name = lead[1].trim();
  return looksLikeName(name) ? name : null;
}

function daysApart(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

function toRef(i: RawItem): SourceRef {
  return { name: i.sourceName, url: i.url, type: i.sourceType, publishedAt: i.publishedAt };
}

/** Lower tier number = better provenance. Ties break toward the earlier publication. */
function betterPrimary(a: RawItem, b: RawItem): RawItem {
  const ta = SOURCE_TIER[a.sourceType], tb = SOURCE_TIER[b.sourceType];
  if (ta !== tb) return ta < tb ? a : b;
  const pa = a.publishedAt ? Date.parse(a.publishedAt) : Infinity;
  const pb = b.publishedAt ? Date.parse(b.publishedAt) : Infinity;
  return pa <= pb ? a : b;
}

/**
 * Cluster near-identical reports of the same event into one item with many sources.
 * Three passes, cheapest first:
 *   1. identical canonical URL
 *   2. same company + overlapping publication window
 *   3. title similarity (token Jaccard OR trigram) within a 4-day window
 */
export function cluster(items: RawItem[], known: Record<string, string> = {}): {
  clusters: Cluster[];
  duplicatesRemoved: number;
} {
  const byUrl = new Map<string, RawItem[]>();
  for (const it of items) {
    const arr = byUrl.get(it.canonicalUrl);
    if (arr) arr.push(it);
    else byUrl.set(it.canonicalUrl, [it]);
  }

  const seeds: RawItem[][] = [...byUrl.values()];
  const clusters: Cluster[] = [];
  const now = new Date().toISOString();

  for (const group of seeds) {
    const rep = group.reduce(betterPrimary);
    const repCompany = guessCompany(rep.title);
    const repTokens = tokens(rep.title);

    const target = clusters.find((c) => {
      const cCompany = guessCompany(c.primary.title);
      const within = daysApart(c.primary.publishedAt, rep.publishedAt) <= 4;
      if (!within) return false;
      if (repCompany && cCompany && repCompany.toLowerCase() === cCompany.toLowerCase()) {
        // Same company in the same window: merge only if the headlines also rhyme,
        // so "Zepto raises" and "Zepto lays off" stay separate events.
        return jaccard(repTokens, tokens(c.primary.title)) >= 0.28 ||
               trigramSim(rep.title, c.primary.title) >= 0.42;
      }
      return jaccard(repTokens, tokens(c.primary.title)) >= 0.55 ||
             trigramSim(rep.title, c.primary.title) >= 0.66;
    });

    if (target) {
      target.members.push(...group);
      for (const g of group) {
        if (!target.sources.some((s) => s.url === g.url)) target.sources.push(toRef(g));
      }
      target.primary = betterPrimary(target.primary, rep);
      target.lastUpdatedAt = now;
    } else {
      const id = hash(`${normaliseTitle(rep.title)}|${repCompany ?? ""}`);
      clusters.push({
        id,
        primary: rep,
        members: [...group],
        sources: group.map(toRef),
        firstSeenAt: known[id] ?? now,
        lastUpdatedAt: now,
      });
    }
  }

  const duplicatesRemoved = items.length - clusters.length;
  return { clusters, duplicatesRemoved };
}

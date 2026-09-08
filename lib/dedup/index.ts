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
export function guessCompany(title: string): string | null {
  const cleaned = title.replace(/^(Exclusive|Breaking|Update|Report)[:—-]\s*/i, "");
  const m = cleaned.match(/^([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,2})/);
  if (!m) return null;
  const name = m[1].trim();
  if (name.split(/\s+/).length > 3 || name.length < 2) return null;
  if (STOP.has(name.toLowerCase())) return null;
  return name;
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

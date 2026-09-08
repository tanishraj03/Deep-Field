import type {
  Category, Confidence, FundingFacts, IntelligenceItem, MarketingFacts,
  Region, ScoreBreakdown, SourceRef,
} from "@/lib/types";

// Pure derivation — a company profile is a *view* over items we already hold.
// Nothing here fetches, infers or enriches. If a fact was never in a source,
// it stays missing and is reported as missing.

export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** The company a given item is about, if it is about one at all. */
export function companyOf(item: IntelligenceItem): string | null {
  const name = item.funding?.companyName ?? item.marketing?.companyName ?? null;
  // When the headline named no company, extraction falls back to the source.
  // A publication is not a company we can pitch, so it must never open a
  // profile — better no entry than a profile for Entrackr or afaqs!.
  if (!name || name.toLowerCase() === item.sourceName.toLowerCase()) return null;
  return name;
}

export interface TimelineEntry {
  at: string;
  kind: "funding" | "marketing" | "trend" | "observed";
  label: string;
  detail: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface CompanyProfile {
  slug: string;
  name: string;
  region: Region;
  categories: Category[];

  funding: FundingFacts | null;
  marketing: MarketingFacts | null;

  opportunityScore: number | null;
  opportunityBreakdown: ScoreBreakdown[] | null;
  scoreIsEstimated: boolean;

  creatorCategories: string[];
  pitchIdeas: string[];
  contactRoles: string[];

  whatTheyDo: string | null;
  whyWeCare: string | null;
  creatorOpportunity: string | null;
  generatedBy: "gemini" | "rules" | null;

  confidenceLabel: Confidence;
  sources: SourceRef[];
  items: IntelligenceItem[];
  timeline: TimelineEntry[];

  firstSeenAt: string;
  lastUpdatedAt: string;

  /** Explicit gaps. Shown to the reader rather than quietly omitted. */
  unknowns: string[];
}

export interface CompanyIndexEntry {
  slug: string;
  name: string;
  region: Region;
  categories: Category[];
  opportunityScore: number | null;
  hasFunding: boolean;
  hasMarketing: boolean;
  lastUpdatedAt: string;
}

/** Every company we hold at least one item about, best first. */
export function listCompanies(items: IntelligenceItem[]): CompanyIndexEntry[] {
  const byslug = new Map<string, IntelligenceItem[]>();
  for (const item of items) {
    const name = companyOf(item);
    if (!name) continue;
    const slug = companySlug(name);
    if (!slug) continue;
    const bucket = byslug.get(slug);
    if (bucket) bucket.push(item);
    else byslug.set(slug, [item]);
  }

  return [...byslug.entries()]
    .map(([slug, group]) => {
      const primary = pickPrimary(group);
      return {
        slug,
        name: companyOf(primary) ?? primary.title,
        region: primary.region,
        categories: mergeCategories(group),
        opportunityScore: bestScore(group),
        hasFunding: group.some((i) => i.funding),
        hasMarketing: group.some((i) => i.marketing),
        lastUpdatedAt: group
          .map((i) => i.lastUpdatedAt)
          .sort()
          .at(-1) as string,
      };
    })
    .sort((a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1));
}

function pickPrimary(group: IntelligenceItem[]): IntelligenceItem {
  // Funding carries the most structured facts, so it anchors the profile.
  return (
    group.find((i) => i.funding) ??
    group.find((i) => i.marketing) ??
    group[0]
  );
}

function mergeCategories(group: IntelligenceItem[]): Category[] {
  const seen = new Set<Category>();
  for (const i of group) for (const c of i.categories) seen.add(c);
  return [...seen];
}

function bestScore(group: IntelligenceItem[]): number | null {
  const scores = group
    .map((i) => i.opportunityScore)
    .filter((s): s is number => typeof s === "number");
  return scores.length ? Math.max(...scores) : null;
}

const CONFIDENCE_RANK: Record<Confidence, number> = { High: 3, Medium: 2, Low: 1 };

export function buildCompanyProfile(
  items: IntelligenceItem[],
  slug: string,
): CompanyProfile | null {
  const group = items.filter((i) => {
    const name = companyOf(i);
    return name ? companySlug(name) === slug : false;
  });
  if (group.length === 0) return null;

  const primary = pickPrimary(group);
  const name = companyOf(primary) as string;

  const fundingItem = group.find((i) => i.funding) ?? null;
  const marketingItem = group.find((i) => i.marketing) ?? null;
  const scored = group
    .filter((i) => typeof i.opportunityScore === "number")
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))[0] ?? null;

  // Sources deduplicated by URL across every item about this company.
  const sourceMap = new Map<string, SourceRef>();
  for (const i of group) for (const s of i.sources) if (!sourceMap.has(s.url)) sourceMap.set(s.url, s);
  const sources = [...sourceMap.values()].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  const confidenceLabel = group
    .map((i) => i.confidenceLabel)
    .sort((a, b) => CONFIDENCE_RANK[b] - CONFIDENCE_RANK[a])[0];

  const analysis = group.find((i) => i.analysis)?.analysis ?? null;

  const firstSeenAt = group.map((i) => i.firstSeenAt).sort()[0];
  const lastUpdatedAt = group.map((i) => i.lastUpdatedAt).sort().at(-1) as string;

  return {
    slug,
    name,
    region: primary.region,
    categories: mergeCategories(group),

    funding: fundingItem?.funding ?? null,
    marketing: marketingItem?.marketing ?? null,

    opportunityScore: scored?.opportunityScore ?? null,
    opportunityBreakdown: scored?.opportunityBreakdown ?? null,
    scoreIsEstimated: Boolean(scored?.scoreIsEstimated),

    creatorCategories: unique(group.flatMap((i) => i.creatorCategories ?? [])),
    pitchIdeas: unique(group.flatMap((i) => i.pitchIdeas ?? [])),
    contactRoles: unique(group.flatMap((i) => i.contactRoles ?? [])),

    whatTheyDo: analysis?.whatHappened ?? primary.summary ?? null,
    whyWeCare: analysis?.whyWeCare ?? null,
    creatorOpportunity: analysis?.creatorOpportunity ?? null,
    generatedBy: analysis?.generatedBy ?? null,

    confidenceLabel,
    sources,
    items: group,
    timeline: buildTimeline(group),

    firstSeenAt,
    lastUpdatedAt,
    unknowns: findUnknowns(fundingItem?.funding ?? null, marketingItem?.marketing ?? null, group),
  };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/**
 * Everything datable we hold, newest first. "Observed" entries are our own
 * first sighting, deliberately distinguished from the event date itself —
 * when we noticed something is not when it happened.
 */
function buildTimeline(group: IntelligenceItem[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];

  for (const i of group) {
    if (i.funding) {
      out.push({
        at: i.funding.announcedAt ?? i.publishedAt ?? i.firstSeenAt,
        kind: "funding",
        label: i.funding.round
          ? `${i.funding.round} announced`
          : "Funding announced",
        detail: i.funding.amountDisclosed
          ? `${i.funding.amountRaw}${i.funding.investors.length ? ` · ${i.funding.investors.join(", ")}` : ""}`
          : "Amount not publicly disclosed",
        sourceName: i.sourceName,
        sourceUrl: i.sourceUrl,
      });
    }

    if (i.marketing) {
      out.push({
        at: i.publishedAt ?? i.firstSeenAt,
        kind: "marketing",
        label: `Marketing activity ${i.marketing.activityLevel}`,
        detail: i.marketing.signals.length ? i.marketing.signals.join(" · ") : null,
        sourceName: i.sourceName,
        sourceUrl: i.sourceUrl,
      });
    }

    if (i.type === "trend") {
      out.push({
        at: i.publishedAt ?? i.firstSeenAt,
        kind: "trend",
        label: i.title,
        detail: i.trendLabel ? `${i.trendLabel} · ${i.trendScore}/100` : null,
        sourceName: i.sourceName,
        sourceUrl: i.sourceUrl,
      });
    }

    out.push({
      at: i.firstSeenAt,
      kind: "observed",
      label: "First seen by this system",
      detail: `${i.sources.length} source${i.sources.length === 1 ? "" : "s"}${
        i.duplicatesMerged > 0 ? ` · ${i.duplicatesMerged} duplicate reports merged` : ""
      }`,
      sourceName: null,
      sourceUrl: null,
    });
  }

  return out
    .filter((e) => Number.isFinite(Date.parse(e.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * The gaps, stated out loud. A profile that looks complete when it is not is
 * worse than an obviously thin one — the reader calibrates on what is shown.
 */
function findUnknowns(
  funding: FundingFacts | null,
  marketing: MarketingFacts | null,
  group: IntelligenceItem[],
): string[] {
  const gaps: string[] = [];

  if (!funding) {
    gaps.push("No funding event on record — this company reached us through marketing or trend signals only.");
  } else {
    if (!funding.amountDisclosed) gaps.push("Funding amount was not disclosed in any source we hold.");
    if (!funding.investors.length) gaps.push("Investors were not named in any source we hold.");
    if (!funding.round) gaps.push("Round stage was not stated.");
  }

  if (!marketing) {
    gaps.push("No marketing activity observed yet. Absence of signal is not evidence of inactivity.");
  } else if (!marketing.spendReported) {
    gaps.push("Marketing spend is not publicly disclosed. The activity level is inferred from observable signals, not from a budget figure.");
  }

  gaps.push("Headcount, revenue, existing creator partnerships and contact details are not collected — no free public source provides them reliably.");

  if (group.every((i) => i.sources.length < 2)) {
    gaps.push("Single-source reporting. Treat as unconfirmed until a second publication carries it.");
  }

  return gaps;
}

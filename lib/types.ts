// Shared vocabulary for the whole system. If a concept is not here, it does not exist.

export type Region = "IN" | "US" | "EU" | "SEA" | "ME" | "GLOBAL";
export type Scope = "INDIA" | "GLOBAL" | "ALL";

export type Platform =
  | "instagram" | "tiktok" | "youtube" | "x" | "linkedin"
  | "reddit" | "threads" | "facebook" | "google-trends" | "web";

export type Category =
  | "Culture" | "Entertainment" | "Music" | "Fashion" | "Food" | "Gaming"
  | "AI" | "Technology" | "Finance" | "Beauty" | "Fitness" | "Education"
  | "Travel" | "Consumer" | "Creator Economy" | "SaaS" | "Fintech"
  | "Healthtech" | "Edtech" | "D2C" | "Mobility" | "Climate" | "Media"
  | "Productivity" | "Developer Tools" | "Robotics" | "Deep Tech";

export type ItemType = "trend" | "funding" | "marketing" | "company";

/** How much we are allowed to claim about a statement. Never blur these. */
export type Veracity = "FACT" | "SIGNAL" | "AI_INTERPRETATION";

export type Confidence = "High" | "Medium" | "Low";

export type SourceType =
  | "company-announcement" | "platform-announcement" | "regulatory"
  | "reputable-publication" | "industry-publication" | "public-social"
  | "community" | "aggregator" | "trend-index";

/** Source tier 1 (best provenance) → 8. Drives conflict resolution + confidence. */
export const SOURCE_TIER: Record<SourceType, number> = {
  "company-announcement": 1,
  "platform-announcement": 2,
  regulatory: 3,
  "reputable-publication": 4,
  "industry-publication": 5,
  "public-social": 6,
  community: 7,
  aggregator: 8,
  "trend-index": 6,
};

export interface SourceRef {
  name: string;
  url: string;
  type: SourceType;
  publishedAt: string | null;
}

/** A single normalised item pulled from one source, before clustering. */
export interface RawItem {
  key: string;
  title: string;
  summary: string;
  url: string;
  canonicalUrl: string;
  sourceName: string;
  sourceType: SourceType;
  publishedAt: string | null;
  fetchedAt: string;
  region: Region;
  platform: Platform;
  categories: Category[];
  language: string;
}

export interface FundingFacts {
  companyName: string;
  amountUsd: number | null;
  amountRaw: string | null;
  round: string | null;
  investors: string[];
  announcedAt: string | null;
  /** true only when the numbers were parsed out of source text, never inferred. */
  amountDisclosed: boolean;
}

export interface MarketingFacts {
  companyName: string;
  activityLevel: "HIGH" | "ELEVATED" | "NOTABLE";
  signals: string[];
  spendReported: { amountRaw: string; sourceUrl: string } | null;
}

export interface ScoreBreakdown {
  label: string;
  weight: number;
  value: number;
  note: string;
}

export interface IntelligenceItem {
  id: string;
  type: ItemType;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string | null;
  firstSeenAt: string;
  lastUpdatedAt: string;
  region: Region;
  platform: Platform;
  categories: Category[];

  confidence: number;   // 0-1
  relevance: number;    // 0-1
  novelty: number;      // 0-1

  sources: SourceRef[];
  duplicatesMerged: number;
  isUpdate: boolean;
  isNew: boolean;

  // Trend-shaped
  trendScore?: number;
  trendLabel?: "BREAKOUT" | "RISING" | "WATCH" | "LOW SIGNAL";
  trendBreakdown?: ScoreBreakdown[];
  scoreIsEstimated?: boolean;

  // Funding-shaped
  funding?: FundingFacts;

  // Marketing-shaped
  marketing?: MarketingFacts;

  // Opportunity-shaped
  opportunityScore?: number;
  opportunityBreakdown?: ScoreBreakdown[];
  creatorCategories?: string[];
  pitchIdeas?: string[];
  contactRoles?: string[];

  // Narrative, clearly attributed
  analysis?: {
    whatHappened: string;
    whyItsMoving: string;
    creatorOpportunity: string;
    brandOpportunity: string;
    whyWeCare: string;
    veracity: Veracity;
    generatedBy: "gemini" | "rules";
  };
  confidenceLabel: Confidence;
  signalLabel: "EARLY SIGNAL" | "PUBLIC WEB SIGNAL" | "SOCIAL SIGNAL" | "REPORTED";
}

/**
 * A recurring content pattern observed across today's items — the "what should
 * we actually make" layer. Interpretation, never fact: every bucket must cite
 * the items it was drawn from so a reader can check the evidence themselves.
 */
export interface ContentBucket {
  name: string;
  whyItWorks: string;
  format: "short-form" | "long-form" | "both";
  platforms: string[];
  /** Titles of the collected items this pattern was read from. */
  evidence: string[];
  generatedBy: "gemini" | "rules";
}

export interface DailyBrief {
  id: string;
  date: string;
  generatedAt: string;
  theSignal: { headline: string; reasoning: string; generatedBy: "gemini" | "rules" };
  fiveThings: string[];
  whatsMoving: string[];
  moneyMoves: string[];
  whosSpending: string[];
  whoToTalkTo: string[];
  watch: string[];
  contentBuckets: ContentBucket[];
  /**
   * Why contentBuckets is empty, when it is. "No pattern in today's items" and
   * "the model call failed" are different facts and the reader deserves to
   * know which — a blank section that cannot explain itself hid a broken
   * evidence check for days.
   */
  bucketNote?: string;
}

export interface SourceRun {
  source: string;
  ok: boolean;
  items: number;
  ms: number;
  error?: string;
  skippedReason?: string;
}

export interface SyncRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  sourcesChecked: number;
  sourcesFailed: number;
  rawItems: number;
  duplicatesRemoved: number;
  newSignals: number;
  aiRequests: number;
  aiSkipped: boolean;
  aiSkipReason?: string;
  runs: SourceRun[];
  mode: "live" | "mock";
}

export interface Snapshot {
  generatedAt: string;
  mode: "live" | "mock";
  items: IntelligenceItem[];
  brief: DailyBrief | null;
  lastRun: SyncRun | null;
}

export interface UsageStat {
  day: string;
  month: string;
  requestsToday: number;
  requestsThisMonth: number;
  estimatedTokensToday: number;
  dailyCap: number;
  monthlyCap: number;
  blocked: boolean;
  blockReason?: string;
}

import type { DailyBrief, IntelligenceItem } from "@/lib/types";

export interface TrendAnalysis {
  whatHappened: string;
  whyItsMoving: string;
  creatorOpportunity: string;
  brandOpportunity: string;
}
export interface FundingAnalysis {
  whatTheyDo: string;
  whyWeCare: string;
  creatorCategories: string[];
}
export interface MarketingAnalysis {
  whatWereSeeing: string;
  whyNow: string;
  creatorCategories: string[];
  possiblePitch: string;
}
export interface OpportunityAnalysis {
  reasons: string[];
  pitchIdeas: string[];
  contactRoles: string[];
}
export interface SignalOutput { headline: string; reasoning: string }

/**
 * The only interface the rest of the app knows about.
 * Swapping models means writing one new class, not touching the pipeline.
 */
export interface AIProvider {
  readonly id: string;
  readonly isFree: boolean;
  available(): Promise<boolean>;

  generateAnalysis(input: unknown): Promise<unknown>;
  classifyTrend(item: IntelligenceItem): Promise<TrendAnalysis>;
  analyzeFunding(item: IntelligenceItem): Promise<FundingAnalysis>;
  analyzeMarketing(item: IntelligenceItem): Promise<MarketingAnalysis>;
  scoreOpportunity(item: IntelligenceItem): Promise<OpportunityAnalysis>;
  generateCompanySummary(name: string, items: IntelligenceItem[]): Promise<string>;
  generateDailyBrief(items: IntelligenceItem[]): Promise<Omit<DailyBrief, "id" | "date" | "generatedAt">>;
  generateSignal(items: IntelligenceItem[]): Promise<SignalOutput>;
}

import type { ContentBucket, DailyBrief, IntelligenceItem } from "@/lib/types";
import { truncate } from "@/lib/utils";
import type {
  AIProvider, FundingAnalysis, MarketingAnalysis, OpportunityAnalysis, SignalOutput, TrendAnalysis,
} from "./provider";

const ND = "Not publicly disclosed";

function categoriesFor(item: IntelligenceItem): string[] {
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  const out = new Set<string>();
  if (/ai|tech|app|software|developer/.test(hay)) out.add("Tech");
  if (/beauty|skincare|fashion|apparel/.test(hay)) { out.add("Beauty"); out.add("Fashion"); }
  if (/food|snack|beverage|restaurant/.test(hay)) out.add("Food");
  if (/game|gaming|esports/.test(hay)) out.add("Gaming");
  if (/finance|payment|invest|fintech/.test(hay)) out.add("Finance");
  if (/fitness|wellness|health/.test(hay)) out.add("Fitness");
  if (/learn|edu|course/.test(hay)) out.add("Education");
  out.add("Lifestyle");
  return [...out].slice(0, 5);
}

/**
 * The deterministic provider. No model, no network, no quota.
 * Used when Gemini is unconfigured, unavailable or over its free cap.
 * Output is deliberately plainer than the model's — it describes the evidence
 * rather than interpreting it, and is labelled as rules-generated in the UI.
 */
export class RulesProvider implements AIProvider {
  readonly id = "rules";
  readonly isFree = true;
  async available() { return true; }
  async generateAnalysis(input: unknown) { return input; }

  async classifyTrend(item: IntelligenceItem): Promise<TrendAnalysis> {
    const srcs = item.sources.map((s) => s.name).join(", ");
    return {
      whatHappened: truncate(item.summary || item.title, 320),
      whyItsMoving: `Picked up by ${item.sources.length} source${item.sources.length === 1 ? "" : "s"} (${srcs}) within the last few days.`,
      creatorOpportunity: "AI interpretation unavailable — read the sources and judge the creator angle directly.",
      brandOpportunity: `Relevant brand categories, inferred from keywords: ${categoriesFor(item).join(", ")}.`,
    };
  }

  async analyzeFunding(item: IntelligenceItem): Promise<FundingAnalysis> {
    const f = item.funding;
    return {
      whatTheyDo: truncate(item.summary || ND, 260),
      whyWeCare: f?.amountRaw
        ? `Raised ${f.amountRaw}${f.round ? ` at ${f.round}` : ""}. Newly funded companies typically increase marketing in the following quarter.`
        : `Round size ${ND}. Flagged because a funding event was detected in the source text.`,
      creatorCategories: categoriesFor(item),
    };
  }

  async analyzeMarketing(item: IntelligenceItem): Promise<MarketingAnalysis> {
    const m = item.marketing;
    return {
      whatWereSeeing: m?.signals.length
        ? `Observable activity: ${m.signals.join(", ")}.`
        : truncate(item.summary || ND, 260),
      whyNow: "AI interpretation unavailable — strategic reasoning not generated.",
      creatorCategories: categoriesFor(item),
      possiblePitch: "AI interpretation unavailable — draft a pitch from the signals listed above.",
    };
  }

  async scoreOpportunity(item: IntelligenceItem): Promise<OpportunityAnalysis> {
    const reasons = (item.opportunityBreakdown ?? [])
      .filter((b) => b.value / b.weight >= 0.6)
      .map((b) => `${b.label}: ${b.note}`)
      .slice(0, 5);
    return {
      reasons: reasons.length ? reasons : ["Scored on deterministic signals only"],
      pitchIdeas: ["AI interpretation unavailable — no pitch concepts generated."],
      contactRoles: ["Marketing", "Brand Partnerships", "Growth"],
    };
  }

  async generateCompanySummary(name: string, items: IntelligenceItem[]): Promise<string> {
    return `${items.length} item${items.length === 1 ? "" : "s"} on record for ${name}. Most recent: ${truncate(items[0]?.title ?? ND, 160)}`;
  }

  async generateSignal(items: IntelligenceItem[]): Promise<SignalOutput> {
    const top = [...items].sort((a, b) => (b.trendScore ?? b.opportunityScore ?? 0) - (a.trendScore ?? a.opportunityScore ?? 0))[0];
    const funding = items.filter((i) => i.type === "funding").length;
    const marketing = items.filter((i) => i.type === "marketing").length;
    const trends = items.filter((i) => i.type === "trend").length;
    return {
      headline: top
        ? `${trends} social signals, ${funding} funding events and ${marketing} marketing moves collected today. Strongest single item: ${truncate(top.title, 110)}`
        : "No qualifying intelligence collected in this run.",
      reasoning: `Generated without AI. Counts are measured from ${items.length} deduplicated items across ${new Set(items.flatMap((i) => i.sources.map((s) => s.name))).size} sources. Connect a Gemini key, or wait for the daily cap to reset, to get a synthesised pattern instead of a tally.`,
    };
  }

  async generateDailyBrief(items: IntelligenceItem[]): Promise<Omit<DailyBrief, "id" | "date" | "generatedAt">> {
    const line = (i: IntelligenceItem) => `${truncate(i.title, 120)} (${i.sources[0]?.name ?? "source"})`;
    const of = (t: string) => items.filter((i) => i.type === t);
    const byScore = (a: IntelligenceItem, b: IntelligenceItem) =>
      (b.opportunityScore ?? b.trendScore ?? 0) - (a.opportunityScore ?? a.trendScore ?? 0);

    return {
      theSignal: { headline: "", reasoning: "", generatedBy: "rules" },
      fiveThings: [...items].sort(byScore).slice(0, 5).map(line),
      whatsMoving: of("trend").sort(byScore).slice(0, 3).map(line),
      moneyMoves: of("funding").slice(0, 3).map(line),
      whosSpending: of("marketing").slice(0, 3).map(line),
      whoToTalkTo: [...items].filter((i) => (i.opportunityScore ?? 0) > 0).sort(byScore).slice(0, 3)
        .map((i) => `${i.funding?.companyName ?? i.marketing?.companyName ?? truncate(i.title, 40)} — ${i.opportunityScore}/100`),
      contentBuckets: [],
      watch: items.filter((i) => i.signalLabel === "EARLY SIGNAL").slice(0, 3).map(line),
    };
  }

  /**
   * Deterministic fallback: group the day's items by the categories they were
   * already tagged with and describe the group. No pattern is claimed beyond
   * what the counts support, and every bucket cites real titles.
   */
  async deriveContentBuckets(items: IntelligenceItem[]): Promise<Omit<ContentBucket, "generatedBy">[]> {
    const byCategory = new Map<string, IntelligenceItem[]>();
    for (const i of items) {
      for (const c of i.categories.slice(0, 2)) {
        byCategory.set(c, [...(byCategory.get(c) ?? []), i]);
      }
    }
    return [...byCategory.entries()]
      .filter(([, group]) => group.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 4)
      .map(([category, group]) => {
        const shorts = group.filter((i) => i.platform === "youtube" || i.platform === "tiktok").length;
        const platforms = [...new Set(group.map((i) => i.platform))].filter((p) => p !== "web");
        return {
          name: `${category} activity`,
          whyItWorks:
            `${group.length} items in ${category} today across ${platforms.length || 1} platform(s). ` +
            `Grouped by category from collected items — no pattern inferred beyond the count.`,
          format: (shorts > group.length / 2 ? "short-form" : "both") as "short-form" | "both",
          platforms: platforms.length ? platforms : ["web"],
          evidence: group.slice(0, 4).map((i) => i.title),
        };
      });
  }

}

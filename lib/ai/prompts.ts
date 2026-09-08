import type { IntelligenceItem } from "@/lib/types";
import { truncate } from "@/lib/utils";

/**
 * House rules attached to every prompt. The model interprets; it never supplies
 * facts. If it does not know something it must say so, in these exact words.
 */
export const GUARDRAILS = `You are an analyst for an influencer-marketing team in India.
Rules you must never break:
- Use ONLY the evidence given. Never add a company, investor, figure, date, campaign or engagement number that is not present.
- If a fact is missing, write exactly: "Not publicly disclosed".
- Never estimate marketing spend. Describe observable activity instead.
- Never claim a social platform reported something unless the evidence says so.
- Be concrete and plain. No hype adjectives, no "game-changing", no exclamation marks.
- Reply with JSON only. No markdown fences, no commentary.`;

function evidence(item: IntelligenceItem): string {
  return [
    `TITLE: ${item.title}`,
    `SUMMARY: ${truncate(item.summary, 600)}`,
    `PUBLISHED: ${item.publishedAt ?? "unknown"}`,
    `REGION: ${item.region}`,
    `CATEGORIES: ${item.categories.join(", ") || "unclassified"}`,
    `SOURCES: ${item.sources.map((s) => s.name).join(", ")}`,
    item.funding ? `FUNDING PARSED: amount=${item.funding.amountRaw ?? "not disclosed"} round=${item.funding.round ?? "not disclosed"} investors=${item.funding.investors.join(", ") || "not disclosed"}` : "",
    item.marketing ? `MARKETING SIGNALS OBSERVED: ${item.marketing.signals.join(", ") || "none"}` : "",
  ].filter(Boolean).join("\n");
}

export const prompts = {
  classifyTrend: (item: IntelligenceItem) => `${GUARDRAILS}

Interpret this signal for a team that books creator collaborations.

${evidence(item)}

JSON shape:
{"whatHappened":"2-4 factual sentences","whyItsMoving":"1-2 sentences on the mechanism","creatorOpportunity":"1-2 sentences on how a creator could use this","brandOpportunity":"1-2 sentences on which kinds of brands could activate around it"}`,

  analyzeFunding: (item: IntelligenceItem) => `${GUARDRAILS}

A company has raised money. Explain it, then explain why it might need influencer marketing.

${evidence(item)}

JSON shape:
{"whatTheyDo":"1-2 factual sentences","whyWeCare":"2-3 sentences on why this company may need creator-led marketing now","creatorCategories":["3-5 creator category names"]}`,

  analyzeMarketing: (item: IntelligenceItem) => `${GUARDRAILS}

A company is showing increased marketing activity. Do NOT state any spend figure.

${evidence(item)}

JSON shape:
{"whatWereSeeing":"2-3 sentences describing observable activity only","whyNow":"1-2 sentences of strategic reasoning","creatorCategories":["3-5 creator category names"],"possiblePitch":"one concrete collaboration concept, one sentence"}`,

  scoreOpportunity: (item: IntelligenceItem) => `${GUARDRAILS}

Explain why this company is or is not worth approaching for a creator collaboration.

${evidence(item)}
DETERMINISTIC SCORE: ${item.opportunityScore ?? "n/a"}/100
COMPONENTS: ${(item.opportunityBreakdown ?? []).map((b) => `${b.label} ${b.value}/${b.weight}`).join("; ")}

JSON shape:
{"reasons":["3-5 short bullet reasons, each under 9 words"],"pitchIdeas":["2-3 concrete collaboration concepts, one sentence each"],"contactRoles":["2-4 job titles to approach"]}`,

  companySummary: (name: string, items: IntelligenceItem[]) => `${GUARDRAILS}

Summarise what we know about ${name} from these items only.

${items.map((i, n) => `[${n + 1}] ${i.title} — ${truncate(i.summary, 200)}`).join("\n")}

JSON shape: {"summary":"3-4 factual sentences"}`,

  signal: (items: IntelligenceItem[]) => `${GUARDRAILS}

Below is today's collected intelligence. Identify the single most important pattern
connecting several items. Do not simply restate the top headline — name the pattern.

${items.slice(0, 18).map((i, n) => `[${n + 1}] (${i.type}, ${i.region}) ${i.title} — ${truncate(i.summary, 160)}`).join("\n")}

JSON shape:
{"headline":"one sentence, max 45 words, describing the pattern","reasoning":"3-5 sentences explaining the evidence behind it and what it means for creator collaborations"}`,

  dailyBrief: (items: IntelligenceItem[]) => `${GUARDRAILS}

Write a morning brief readable in under three minutes.

${items.slice(0, 22).map((i, n) => `[${n + 1}] (${i.type}, ${i.region}, score ${i.opportunityScore ?? i.trendScore ?? "-"}) ${i.title} — ${truncate(i.summary, 160)}`).join("\n")}

JSON shape:
{"fiveThings":["exactly 5 items, one sentence each"],"whatsMoving":["up to 3 one-line social signals"],"moneyMoves":["up to 3 one-line funding notes"],"whosSpending":["up to 3 one-line marketing notes"],"whoToTalkTo":["up to 3 lines, format: Company — why"],"watch":["up to 3 early signals not yet mainstream"]}`,
};

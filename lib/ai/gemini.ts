import { z } from "zod";
import { config, isFreeTierModel } from "@/lib/config";
import { fetchWithTimeout, truncate } from "@/lib/utils";
import type { ContentBucket, DailyBrief, IntelligenceItem } from "@/lib/types";
import { prompts } from "./prompts";
import { reserve } from "./usage";
import type {
  AIProvider, FundingAnalysis, MarketingAnalysis, OpportunityAnalysis, SignalOutput, TrendAnalysis,
} from "./provider";

const strArr = z.array(z.string()).default([]);

const Schemas = {
  trend: z.object({
    whatHappened: z.string(), whyItsMoving: z.string(),
    creatorOpportunity: z.string(), brandOpportunity: z.string(),
  }),
  funding: z.object({
    whatTheyDo: z.string(), whyWeCare: z.string(), creatorCategories: strArr,
  }),
  marketing: z.object({
    whatWereSeeing: z.string(), whyNow: z.string(),
    creatorCategories: strArr, possiblePitch: z.string(),
  }),
  opportunity: z.object({ reasons: strArr, pitchIdeas: strArr, contactRoles: strArr }),
  signal: z.object({ headline: z.string(), reasoning: z.string() }),
  brief: z.object({
    fiveThings: strArr, whatsMoving: strArr, moneyMoves: strArr,
    whosSpending: strArr, whoToTalkTo: strArr, watch: strArr,
  }),
  summary: z.object({ summary: z.string() }),
  // Models answer this one either as {"buckets":[…]} or as a bare […]. Both are
  // valid readings of the instruction, so accept either rather than discarding
  // a good response over its wrapper.
  buckets: z.preprocess(
    (v) => (Array.isArray(v) ? { buckets: v } : v),
    z.object({
      buckets: z.array(z.object({
        name: z.string(),
        whyItWorks: z.string().default(""),
        format: z.string().default("both"),
        platforms: strArr,
        evidence: strArr,
      })).default([]),
    }),
  ),
};

export class QuotaExhausted extends Error {}

/**
 * How long Google says to wait, from a 429's RetryInfo detail or the
 * Retry-After header. Returns null when it says nothing useful.
 */
async function retryAfterMs(res: Response): Promise<number | null> {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  }
  try {
    const body = (await res.clone().json()) as {
      error?: { details?: { "@type"?: string; retryDelay?: string }[] };
    };
    for (const d of body.error?.details ?? []) {
      if (typeof d.retryDelay === "string") {
        const m = d.retryDelay.match(/^([\d.]+)s$/);
        if (m) return Math.round(parseFloat(m[1]) * 1000);
      }
    }
  } catch { /* body already consumed or not JSON */ }
  return null;
}
export class PaidModelBlocked extends Error {}

/**
 * Google AI Studio free tier, called over plain fetch. No SDK, no billing account.
 *
 * Three things protect the bill:
 *  1. FREE_ONLY refuses any model that is not Flash / Flash-Lite class.
 *  2. Every call reserves budget first and throws QuotaExhausted rather than proceeding.
 *  3. A 429 is terminal for the run. We never retry into a rate limit.
 */
export class GeminiFreeProvider implements AIProvider {
  readonly id = "gemini-free";
  readonly isFree = true;
  private resolvedModel: string | null = null;

  async available(): Promise<boolean> {
    if (!config.gemini.apiKey) return false;
    try { await this.model(); return true; } catch { return false; }
  }

  /**
   * Can this model id actually serve a generation request on this key?
   *
   * Metadata is not a reliable answer. A retired model still returns HTTP 200
   * from GET /models/<id> and still advertises "generateContent" in
   * supportedGenerationMethods, while every real call to it returns 404
   * ("no longer available to new users"). The only honest test is to generate.
   * One token, once per process, on the resolution path only.
   */
  private async canGenerate(id: string): Promise<boolean> {
    const res = await fetchWithTimeout(
      `${config.gemini.endpoint}/models/${id}:generateContent?key=${config.gemini.apiKey}`, 8000,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ok" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      },
    ).catch(() => null);
    // A thinking model spends the single token on thought and returns 200 with
    // no text. That still proves the model serves generation, which is the
    // only question being asked here.
    return !!res?.ok;
  }

  /**
   * Model IDs on the free tier move. If the configured ID cannot generate we
   * ask the API which models exist and pick a free-tier-eligible Flash model,
   * rather than silently failing or drifting onto a paid one.
   */
  private async model(): Promise<string> {
    if (this.resolvedModel) return this.resolvedModel;

    const configured = config.gemini.model;
    if (config.freeOnly && !isFreeTierModel(configured)) {
      throw new PaidModelBlocked(
        `GEMINI_MODEL="${configured}" is a paid-tier model. Blocked because FREE_ONLY=true.`,
      );
    }

    if (await this.canGenerate(configured)) { this.resolvedModel = configured; return configured; }

    const list = await fetchWithTimeout(
      `${config.gemini.endpoint}/models?key=${config.gemini.apiKey}&pageSize=100`, 9000,
    );
    if (!list.ok) throw new Error(`Cannot reach Gemini API (HTTP ${list.status})`);

    const json = (await list.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const candidates = (json.models ?? [])
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => isFreeTierModel(n))
      .filter((n) => !/embedding|aqa|tts|image|vision-only/.test(n));

    // Flash-Lite first: it is the cheapest free-tier class and, unlike the
    // thinking Flash models, spends no tokens on reasoning we never read.
    const ordered = [
      ...candidates.filter((n) => /flash-lite/.test(n)),
      ...candidates.filter((n) => !/flash-lite/.test(n) && /flash/.test(n)),
    ];
    for (const id of ordered) {
      if (await this.canGenerate(id)) { this.resolvedModel = id; return id; }
    }
    throw new Error("No free-tier Flash model on this API key can serve generateContent.");
  }

  private async call<T>(
    prompt: string,
    schema: z.ZodType<T>,
    maxTokens = 900,
    opts: { deep?: boolean } = {},
  ): Promise<T> {
    // The deep model is used verbatim when asked for; it is still checked
    // against the free-tier rule, and any failure falls back to the resolved
    // everyday model rather than to something paid.
    const resolved = await this.model();
    const useDeep = Boolean(opts.deep) && isFreeTierModel(config.gemini.deepModel);
    const model = useDeep ? config.gemini.deepModel : resolved;

    // ~4 chars per token, plus the output ceiling.
    const est = Math.ceil(prompt.length / 4) + maxTokens;
    const budget = await reserve(est);
    if (!budget.ok) throw new QuotaExhausted(budget.reason ?? "AI safety cap reached");

    const send = () => fetchWithTimeout(
      `${config.gemini.endpoint}/models/${model}:generateContent?key=${config.gemini.apiKey}`,
      20000,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
            // ONLY on the deep model. Flash-Lite does not accept thinkingConfig
            // and answers 400 INVALID_ARGUMENT, which silently failed every
            // per-item interpretation until the error was surfaced.
            ...(useDeep && config.gemini.disableThinking
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
        // Space calls to stay under the free tier's requests-per-minute
        // ceiling. Without this the pipeline fired every request at once, took
        // a 429 on roughly the sixteenth, and abandoned AI for the whole run —
        // which is why about a third of each morning went uninterpreted.
        minDelayMs: config.ai.minGapMs,
      },
    );

    let res = await send();

    // A 429 is a "wait", not a "stop". Google returns how long to wait; honour
    // it once. Only a second refusal ends AI for the run — we still never sit
    // in a retry loop against a rate limit.
    if (res.status === 429) {
      const retryMs = await retryAfterMs(res);
      if (retryMs !== null && retryMs <= config.ai.maxBackoffMs) {
        await new Promise((r) => setTimeout(r, retryMs));
        res = await send();
      }
    }
    if (res.status === 429) {
      throw new QuotaExhausted("Gemini free-tier rate limit reached, and it stayed rate limited after backing off. Stopping AI for this run.");
    }
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${truncate(await res.text(), 180)}`);

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: unknown;
    try { parsed = JSON.parse(cleaned); }
    catch { throw new Error("Gemini returned unparseable JSON"); }

    const result = schema.safeParse(parsed);
    if (!result.success) throw new Error(`Gemini response failed validation: ${result.error.issues[0]?.message}`);
    return result.data;
  }

  generateAnalysis(input: unknown): Promise<unknown> {
    return this.call(String(input), z.unknown() as z.ZodType<unknown>);
  }
  classifyTrend(item: IntelligenceItem): Promise<TrendAnalysis> {
    return this.call(prompts.classifyTrend(item), Schemas.trend, 700);
  }

  // The list fields below are normalised explicitly rather than trusted from the
  // schema default, so a model that omits a key produces an empty section
  // instead of an undefined that surfaces as "undefined" in the interface.
  async analyzeFunding(item: IntelligenceItem): Promise<FundingAnalysis> {
    const r = await this.call(prompts.analyzeFunding(item), Schemas.funding, 600);
    return { whatTheyDo: r.whatTheyDo, whyWeCare: r.whyWeCare, creatorCategories: r.creatorCategories ?? [] };
  }

  async analyzeMarketing(item: IntelligenceItem): Promise<MarketingAnalysis> {
    const r = await this.call(prompts.analyzeMarketing(item), Schemas.marketing, 650);
    return {
      whatWereSeeing: r.whatWereSeeing, whyNow: r.whyNow,
      possiblePitch: r.possiblePitch, creatorCategories: r.creatorCategories ?? [],
    };
  }

  async scoreOpportunity(item: IntelligenceItem): Promise<OpportunityAnalysis> {
    const r = await this.call(prompts.scoreOpportunity(item), Schemas.opportunity, 650);
    return {
      reasons: r.reasons ?? [], pitchIdeas: r.pitchIdeas ?? [], contactRoles: r.contactRoles ?? [],
    };
  }
  async generateCompanySummary(name: string, items: IntelligenceItem[]): Promise<string> {
    const { summary } = await this.call(prompts.companySummary(name, items), Schemas.summary, 450);
    return summary;
  }
  generateSignal(items: IntelligenceItem[]): Promise<SignalOutput> {
    return this.call(prompts.signal(items), Schemas.signal, 900, { deep: true });
  }
  /**
   * Content buckets are pattern-naming, so the evidence list is verified
   * against real item titles before it is returned. A cited title the model
   * invented is dropped, and a bucket left with no evidence is dropped with
   * it — an unsupported pattern is exactly the thing this must not print.
   */
  async deriveContentBuckets(items: IntelligenceItem[]): Promise<Omit<ContentBucket, "generatedBy">[]> {
    type BucketsOut = { buckets: { name: string; whyItWorks?: string; format?: string; platforms?: string[]; evidence?: string[] }[] };
    const out = await this.call(prompts.contentBuckets(items), Schemas.buckets as unknown as z.ZodType<BucketsOut>, 1600, { deep: true });
    const known = new Set(items.map((i) => i.title.toLowerCase().trim()));
    const asFormat = (v: string): ContentBucket["format"] =>
      v === "short-form" || v === "long-form" ? v : "both";
    return (out.buckets ?? [])
      .map((b) => ({
        name: b.name,
        whyItWorks: b.whyItWorks ?? "",
        format: asFormat(b.format ?? "both"),
        platforms: (b.platforms ?? []).filter(
          (p) => p && !/^not publicly disclosed$/i.test(p.trim()),
        ),
        evidence: (b.evidence ?? []).filter((e) => known.has(e.toLowerCase().trim())),
      }))
      .filter((b) => b.name && b.evidence.length > 0)
      .slice(0, 5);
  }

  async generateDailyBrief(items: IntelligenceItem[]): Promise<Omit<DailyBrief, "id" | "date" | "generatedAt">> {
    const b = await this.call(prompts.dailyBrief(items), Schemas.brief, 1800, { deep: true });
    return {
      fiveThings: b.fiveThings ?? [],
      whatsMoving: b.whatsMoving ?? [],
      moneyMoves: b.moneyMoves ?? [],
      whosSpending: b.whosSpending ?? [],
      whoToTalkTo: b.whoToTalkTo ?? [],
      watch: b.watch ?? [],
      // Filled by generateBrief, which owns the extra call and its fallback.
      contentBuckets: [],
      theSignal: { headline: "", reasoning: "", generatedBy: "gemini" },
    };
  }
}

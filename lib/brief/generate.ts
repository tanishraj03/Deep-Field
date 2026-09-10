import { getAIProvider, QuotaExhausted } from "@/lib/ai";
import { getRepository } from "@/lib/db";
import type { DailyBrief, IntelligenceItem } from "@/lib/types";
import { hash, todayKey } from "@/lib/utils";

/**
 * Two model calls maximum for the whole brief: one for THE SIGNAL, one for the
 * sections. Everything else — selection, ordering, counting — is code.
 */
export async function generateBrief(items: IntelligenceItem[]): Promise<DailyBrief> {
  const { provider } = await getAIProvider();

  // Feed the model only what earned its place: new or accelerating, best first.
  const ranked = [...items]
    .sort((a, b) => (b.novelty * 0.5 + b.relevance * 0.5) - (a.novelty * 0.5 + a.relevance * 0.5))
    .slice(0, 24);

  let sections: Omit<DailyBrief, "id" | "date" | "generatedAt">;
  let signal: { headline: string; reasoning: string; generatedBy: "gemini" | "rules" };
  const generatedBy = provider.id === "gemini-free" ? "gemini" : "rules";

  try {
    signal = { ...(await provider.generateSignal(ranked)), generatedBy };
  } catch (err) {
    const { RulesProvider } = await import("@/lib/ai/rules");
    const fb = await new RulesProvider().generateSignal(ranked);
    signal = { ...fb, generatedBy: "rules" };
    if (!(err instanceof QuotaExhausted)) { /* transient error, already degraded */ }
  }

  try {
    sections = await provider.generateDailyBrief(ranked);
  } catch {
    const { RulesProvider } = await import("@/lib/ai/rules");
    sections = await new RulesProvider().generateDailyBrief(ranked);
  }

  // A third call, and the last: naming the content patterns. Falls back to the
  // deterministic grouping rather than leaving the section blank, and any
  // failure here must not cost us the brief that is already written.
  let contentBuckets: DailyBrief["contentBuckets"] = [];
  // Kept so the caller can say why the section is empty. A bare catch here
  // meant "no buckets today" and "the call failed" looked identical, and the
  // section stayed blank for days without anyone being able to tell which.
  let bucketNote: string | undefined;
  try {
    const raw = await provider.deriveContentBuckets(ranked);
    contentBuckets = raw.map((b) => ({ ...b, generatedBy }));
    if (contentBuckets.length === 0) {
      bucketNote = "Model returned no bucket whose evidence matched a collected item.";
    }
  } catch (err) {
    bucketNote = `Model call failed: ${err instanceof Error ? err.message : "unknown error"}`;
    try {
      const { RulesProvider } = await import("@/lib/ai/rules");
      const raw = await new RulesProvider().deriveContentBuckets(ranked);
      contentBuckets = raw.map((b) => ({ ...b, generatedBy: "rules" as const }));
      if (contentBuckets.length) bucketNote += " — fell back to deterministic grouping.";
    } catch (fallbackErr) {
      bucketNote += ` Fallback also failed: ${fallbackErr instanceof Error ? fallbackErr.message : "unknown"}`;
      contentBuckets = [];
    }
  }
  if (bucketNote) console.warn(`[brief] content buckets: ${bucketNote}`);

  const date = todayKey();
  const brief: DailyBrief = {
    id: hash(`brief:${date}`),
    date,
    generatedAt: new Date().toISOString(),
    ...sections,
    contentBuckets,
    bucketNote,
    theSignal: signal,
  };

  const repo = await getRepository();
  await repo.saveBrief(brief);
  return brief;
}

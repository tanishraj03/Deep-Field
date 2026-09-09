import { config } from "@/lib/config";
import { adapterFor, enabledSources } from "@/lib/sources";
import type { SourceDefinition } from "@/lib/sources";
import { cluster, type Cluster } from "@/lib/dedup";
import { classify, extractFunding, extractMarketing, inferCategories, inferRegion } from "./extract";
import {
  confidence, novelty, relevance, scoreOpportunity, scoreTrend, signalLabel,
} from "@/lib/scoring";
import { getAIProvider, QuotaExhausted } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai";
import { getRepository } from "@/lib/db";
import type { SeenRecord } from "@/lib/db";
import { mockItems, mockRun } from "@/lib/mock/data";
import type { IntelligenceItem, RawItem, SourceRun, SyncRun } from "@/lib/types";
import { daysAgo, hash, pool, truncate } from "@/lib/utils";

// ── 1. Collect ────────────────────────────────────────────────────────────────

async function collectOne(def: SourceDefinition): Promise<{ run: SourceRun; items: RawItem[] }> {
  const started = Date.now();
  try {
    const items = await adapterFor(def).fetch(def);
    return {
      run: { source: def.name, ok: true, items: items.length, ms: Date.now() - started },
      items: items.map((i) => ({ ...i, categories: [...i.categories] })),
    };
  } catch (err) {
    // One dead feed must never take down the morning. Record and carry on.
    return {
      run: {
        source: def.name, ok: false, items: 0, ms: Date.now() - started,
        error: err instanceof Error ? truncate(err.message, 140) : "unknown error",
      },
      items: [],
    };
  }
}

// ── 2..5. Normalise, cluster, classify, score ─────────────────────────────────

function laneOf(def: SourceDefinition[], name: string) {
  return def.find((d) => d.name === name)?.lane ?? "mixed";
}

function buildItem(c: Cluster, seen: Record<string, SeenRecord>, defs: SourceDefinition[]): IntelligenceItem | null {
  const lane = laneOf(defs, c.primary.sourceName);
  const type = classify(c.primary, lane);
  if (!type) return null;

  const prior = seen[c.id];
  const isNew = !prior;
  const isUpdate = !!prior && c.sources.length > prior.sourceCount;

  const conf = confidence(c);
  const trend = scoreTrend(c, prior?.mentions ?? 0);
  const region = inferRegion(c.primary);

  const base: IntelligenceItem = {
    id: c.id,
    type,
    title: c.primary.title,
    summary: c.primary.summary,
    sourceUrl: c.primary.url,
    sourceName: c.primary.sourceName,
    publishedAt: c.primary.publishedAt,
    firstSeenAt: prior?.firstSeenAt ?? c.firstSeenAt,
    lastUpdatedAt: c.lastUpdatedAt,
    region,
    platform: c.primary.platform,
    categories: inferCategories(c.primary),
    confidence: conf.value,
    confidenceLabel: conf.label,
    relevance: relevance(c),
    novelty: novelty(c, !isNew, prior?.sourceCount ?? 0),
    sources: c.sources,
    duplicatesMerged: Math.max(0, c.members.length - 1),
    isNew,
    isUpdate,
    signalLabel: signalLabel(c),
    trendScore: trend.score,
    trendLabel: trend.label,
    trendBreakdown: trend.breakdown,
    scoreIsEstimated: trend.estimated,
  };

  if (type === "funding") base.funding = extractFunding(c.primary);
  if (type === "marketing") base.marketing = extractMarketing(c.primary);

  if (type === "funding" || type === "marketing") {
    const opp = scoreOpportunity(base);
    base.opportunityScore = opp.score;
    base.opportunityBreakdown = opp.breakdown;
  }

  return base;
}

// ── 6. Rank, so only the best items ever cost AI budget ───────────────────────

function priority(i: IntelligenceItem): number {
  return i.relevance * 0.4 + i.novelty * 0.35 + i.confidence * 0.15 +
    ((i.opportunityScore ?? i.trendScore ?? 0) / 100) * 0.1;
}

// ── Full run ──────────────────────────────────────────────────────────────────


/**
 * Attach one item's AI interpretation. Shared by the full pipeline and the
 * analyse-only stage so both label provenance identically — a caller can never
 * accidentally write model output without the AI_INTERPRETATION tag.
 */
async function interpret(item: IntelligenceItem, provider: AIProvider): Promise<void> {
  const generatedBy = provider.id === "gemini-free" ? "gemini" : "rules";
  if (item.type === "funding") {
    const a = await provider.analyzeFunding(item);
    item.analysis = {
      whatHappened: a.whatTheyDo, whyItsMoving: "", creatorOpportunity: "",
      brandOpportunity: "", whyWeCare: a.whyWeCare,
      veracity: "AI_INTERPRETATION", generatedBy,
    };
    item.creatorCategories = a.creatorCategories;
  } else if (item.type === "marketing") {
    const a = await provider.analyzeMarketing(item);
    item.analysis = {
      whatHappened: a.whatWereSeeing, whyItsMoving: a.whyNow, creatorOpportunity: a.possiblePitch,
      brandOpportunity: "", whyWeCare: a.whyNow,
      veracity: "AI_INTERPRETATION", generatedBy,
    };
    item.creatorCategories = a.creatorCategories;
  } else {
    const a = await provider.classifyTrend(item);
    item.analysis = {
      whatHappened: a.whatHappened, whyItsMoving: a.whyItsMoving,
      creatorOpportunity: a.creatorOpportunity, brandOpportunity: a.brandOpportunity,
      whyWeCare: "", veracity: "AI_INTERPRETATION", generatedBy,
    };
  }
}

export interface RunOptions { withAI?: boolean; limitAI?: number }

export async function runPipeline(opts: RunOptions = {}): Promise<{ run: SyncRun; items: IntelligenceItem[] }> {
  const startedAt = new Date().toISOString();
  const runId = hash(startedAt + Math.random());

  if (config.mockData) {
    // Mock items are NEVER written to the store. They used to be, and because
    // they carry real publication names in sourceName they became
    // indistinguishable from real records once a live run followed — the app
    // then showed invented companies attributed to Entrackr and afaqs!, which
    // is the one thing this project must never do. Mock is a render-time
    // substitution only; getSnapshot() swaps it in when config.mockData is set.
    const items = mockItems();
    return { run: mockRun(runId, startedAt, items.length), items };
  }

  const defs = enabledSources();
  const results = await pool(defs, config.ingestion.maxConcurrent, collectOne);
  const runs = results.map((r) => r.run);
  const raw = results.flatMap((r) => r.items);

  // Drop anything outside the lookback window before we spend effort on it.
  const fresh = raw.filter((i) => daysAgo(i.publishedAt) <= config.ingestion.lookbackDays);

  const repo = await getRepository();
  const seen = await repo.getSeen();
  const firstSeenMap = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.firstSeenAt]));

  const { clusters, duplicatesRemoved } = cluster(fresh, firstSeenMap);

  const items = clusters
    .map((c) => buildItem(c, seen, defs))
    .filter((i): i is IntelligenceItem => i !== null)
    .filter((i) => i.relevance >= 0.35)
    .sort((a, b) => priority(b) - priority(a));

  // ── 7. AI, on the shortlist only ───────────────────────────────────────────
  const { provider, degraded, reason } = await getAIProvider();
  let aiRequests = 0;
  let aiSkipped = degraded;
  let aiSkipReason = reason;

  if (opts.withAI !== false) {
    const budget = Math.min(opts.limitAI ?? config.ai.maxItemsPerRun, config.ai.maxItemsPerRun);
    const shortlist = items.slice(0, budget);
    const deadline = Date.now() + config.ai.maxWallClockMs;
    let interpreted = 0;

    for (const item of shortlist) {
      // Stop before the platform kills us mid-request. Partial interpretation
      // that is reported is worth more than a run that dies at the timeout.
      if (Date.now() > deadline) {
        aiSkipped = true;
        aiSkipReason =
          `Interpretation time budget reached — ${interpreted} of ${shortlist.length} items analysed. ` +
          `The rest keep their deterministic scores.`;
        break;
      }
      try {
        await interpret(item, provider); aiRequests++; interpreted++;
      } catch (err) {
        if (err instanceof QuotaExhausted) {
          aiSkipped = true;
          aiSkipReason = err.message;
          break; // stop cleanly; the rest of the run still completes
        }
        // A single bad response is not a reason to abandon the item.
      }
    }
  }

  // ── 8. Persist ─────────────────────────────────────────────────────────────
  const seenRecords: SeenRecord[] = clusters.map((c) => ({
    id: c.id,
    firstSeenAt: seen[c.id]?.firstSeenAt ?? c.firstSeenAt,
    sourceCount: c.sources.length,
    mentions: new Set(c.sources.map((s) => s.name)).size,
  }));
  await repo.putSeen(seenRecords);
  await repo.saveItems(items);

  const run: SyncRun = {
    id: runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    sourcesChecked: runs.length,
    sourcesFailed: runs.filter((r) => !r.ok).length,
    rawItems: raw.length,
    duplicatesRemoved,
    newSignals: items.filter((i) => i.isNew).length,
    aiRequests,
    aiSkipped,
    aiSkipReason,
    runs,
    mode: "live",
  };
  await repo.saveRun(run);

  return { run, items };
}

/**
 * Interpretation only, over items already in the store.
 *
 * The daily workflow used to call one endpoint that collected, interpreted,
 * wrote the brief and posted to Slack in a single request. Once AI calls were
 * paced to respect the per-minute limit that no longer fitted in a Vercel
 * function and the run died at 504. Each stage now does one thing, so none of
 * them approaches the timeout.
 */
export async function runInterpretation(limit?: number): Promise<{
  analysed: number; failed?: number; total: number; aiSkipped: boolean;
  aiSkipReason?: string; firstError?: string; provider: string;
}> {
  const repo = await getRepository();
  const stored = await repo.listItems(200);
  const { provider, degraded, reason } = await getAIProvider();

  // Only items that have not been interpreted yet, best first.
  const pending = stored.filter((i) => !i.analysis).sort((a, b) => priority(b) - priority(a));
  const budget = Math.min(limit ?? config.ai.maxItemsPerRun, config.ai.maxItemsPerRun);
  const shortlist = pending.slice(0, budget);

  if (degraded) {
    return { analysed: 0, total: pending.length, aiSkipped: true, aiSkipReason: reason, provider: provider.id };
  }

  const deadline = Date.now() + config.ai.maxWallClockMs;
  let analysed = 0;
  let failed = 0;
  let aiSkipped = false;
  let aiSkipReason: string | undefined;
  // A swallowed error is indistinguishable from a slow run. The first one is
  // kept and reported so a pass that interprets nothing says why.
  let firstError: string | undefined;

  for (const item of shortlist) {
    if (Date.now() > deadline) {
      aiSkipped = true;
      aiSkipReason = `Time budget reached — ${analysed} interpreted, ${failed} failed, of ${shortlist.length} attempted.` +
        (firstError ? ` First failure: ${firstError}` : "");
      break;
    }
    try {
      await interpret(item, provider);
      analysed++;
    } catch (err) {
      if (err instanceof QuotaExhausted) {
        aiSkipped = true;
        aiSkipReason = err.message;
        break;
      }
      failed++;
      if (!firstError) firstError = err instanceof Error ? truncate(err.message, 160) : "unknown error";
    }
  }

  if (analysed > 0) await repo.saveItems(stored);
  return {
    analysed, failed, total: pending.length, aiSkipped,
    aiSkipReason: aiSkipReason ?? (failed > 0 ? `${failed} interpretation(s) failed. First: ${firstError}` : undefined),
    firstError, provider: provider.id,
  };
}

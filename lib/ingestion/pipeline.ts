import { config } from "@/lib/config";
import { adapterFor, enabledSources } from "@/lib/sources";
import type { SourceDefinition } from "@/lib/sources";
import { cluster, type Cluster } from "@/lib/dedup";
import { classify, extractFunding, extractMarketing, inferCategories, inferRegion } from "./extract";
import {
  confidence, novelty, relevance, scoreOpportunity, scoreTrend, signalLabel,
} from "@/lib/scoring";
import { getAIProvider, QuotaExhausted } from "@/lib/ai";
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

export interface RunOptions { withAI?: boolean; limitAI?: number }

export async function runPipeline(opts: RunOptions = {}): Promise<{ run: SyncRun; items: IntelligenceItem[] }> {
  const startedAt = new Date().toISOString();
  const runId = hash(startedAt + Math.random());

  if (config.mockData) {
    const items = mockItems();
    const repo = await getRepository();
    await repo.saveItems(items);
    const run = mockRun(runId, startedAt, items.length);
    await repo.saveRun(run);
    return { run, items };
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

    for (const item of shortlist) {
      try {
        if (item.type === "funding") {
          const a = await provider.analyzeFunding(item); aiRequests++;
          item.analysis = {
            whatHappened: a.whatTheyDo, whyItsMoving: "", creatorOpportunity: "",
            brandOpportunity: "", whyWeCare: a.whyWeCare,
            veracity: "AI_INTERPRETATION", generatedBy: provider.id === "gemini-free" ? "gemini" : "rules",
          };
          item.creatorCategories = a.creatorCategories;
        } else if (item.type === "marketing") {
          const a = await provider.analyzeMarketing(item); aiRequests++;
          item.analysis = {
            whatHappened: a.whatWereSeeing, whyItsMoving: a.whyNow, creatorOpportunity: a.possiblePitch,
            brandOpportunity: "", whyWeCare: a.whyNow,
            veracity: "AI_INTERPRETATION", generatedBy: provider.id === "gemini-free" ? "gemini" : "rules",
          };
          item.creatorCategories = a.creatorCategories;
        } else {
          const a = await provider.classifyTrend(item); aiRequests++;
          item.analysis = {
            whatHappened: a.whatHappened, whyItsMoving: a.whyItsMoving,
            creatorOpportunity: a.creatorOpportunity, brandOpportunity: a.brandOpportunity,
            whyWeCare: "", veracity: "AI_INTERPRETATION",
            generatedBy: provider.id === "gemini-free" ? "gemini" : "rules",
          };
        }
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

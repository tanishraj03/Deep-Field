import { config } from "@/lib/config";
import { getRepository, repositoryStatus } from "@/lib/db";
import { readUsage } from "@/lib/ai";
import { auditForPaidServices } from "@/lib/config";
import { slackStatus } from "@/lib/slack";
import { mockBriefSections, mockItems, mockRun } from "@/lib/mock/data";
import type { DailyBrief, Snapshot } from "@/lib/types";
import type { SystemStatus } from "@/lib/system-status";
import { hash, todayKey } from "@/lib/utils";

function mockBrief(): DailyBrief {
  return {
    id: hash(`mock-brief:${todayKey()}`),
    date: todayKey(),
    generatedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    theSignal: {
      headline:
        "AI-native consumer products are moving toward creator-led distribution: newly funded consumer apps are launching and increasing social activity in the same week, while the formats gaining fastest in India are the cheapest ones to produce.",
      reasoning:
        "Two of today's funding events are consumer-facing products that named a marketing expansion in the same announcement, which usually means a creator budget is being formed now rather than next quarter. Separately, the two fastest-moving India formats — voice-note desk tours and thrift hauls — both remove a production cost rather than adding a production value. Companies with new money and a demonstrable product are therefore meeting an audience that is rewarding low-cost, high-frequency formats. The practical read: pitch volume and repeatability, not single hero films.",
      generatedBy: "gemini",
    },
    ...mockBriefSections(),
    contentBuckets: [],
  };
}

/** Everything the interface needs for one render, from one place. */
export async function getSnapshot(): Promise<Snapshot> {
  if (config.mockData) {
    const items = mockItems();
    return {
      generatedAt: new Date().toISOString(),
      mode: "mock",
      items,
      brief: mockBrief(),
      lastRun: mockRun(hash("mock-run"), new Date(Date.now() - 42 * 60_000).toISOString(), items.length),
    };
  }

  const repo = await getRepository();
  const [items, brief, lastRun] = await Promise.all([
    repo.listItems(300),
    repo.latestBrief(),
    repo.latestRun(),
  ]);

  return { generatedAt: new Date().toISOString(), mode: "live", items, brief, lastRun };
}

export type { SystemStatus };

export async function getSystemStatus(): Promise<SystemStatus> {
  const usage = await readUsage();
  const repo = await getRepository();
  const lastRun = config.mockData
    ? mockRun(hash("mock-run"), new Date(Date.now() - 42 * 60_000).toISOString(), 5)
    : await repo.latestRun();

  return {
    mode: config.mockData ? "mock" : "live",
    freeOnly: config.freeOnly,
    blocked: auditForPaidServices(),
    ai: {
      ...usage,
      provider: config.gemini.apiKey ? `Gemini free tier (${config.gemini.model})` : "Deterministic rules (no key set)",
    },
    database: repositoryStatus(),
    slack: await slackStatus(),
    cron: {
      configured: Boolean(config.cronSecret),
      note: config.cronSecret
        ? "CRON_SECRET set — the GitHub Action can trigger ingestion"
        : "Set CRON_SECRET to let the GitHub Action trigger ingestion",
    },
    briefHourIst: (await repo.getSettings()).briefHourIst,
    lastRun,
  };
}

export type { FilterState } from "@/lib/filters";
export { defaultFilters, applyFilters } from "@/lib/filters";

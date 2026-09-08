import { config } from "@/lib/config";
import { getRepository } from "@/lib/db";
import type { UsageStat } from "@/lib/types";
import { todayKey } from "@/lib/utils";

function monthKey(): string { return todayKey().slice(0, 7); }

/**
 * The valve that keeps the AI bill at zero.
 * Every request passes through `reserve()`. When the configured safety
 * threshold is crossed we stop, and the pipeline continues without AI.
 */
export async function readUsage(): Promise<UsageStat> {
  const repo = await getRepository();
  const raw = await repo.getUsage(todayKey(), monthKey());
  const dayCap = Math.floor(config.ai.maxPerDay * config.ai.safetyThreshold);
  const monthCap = Math.floor(config.ai.maxPerMonth * config.ai.safetyThreshold);

  const blockedDay = raw.requestsToday >= dayCap;
  const blockedMonth = raw.requestsThisMonth >= monthCap;

  return {
    day: todayKey(),
    month: monthKey(),
    requestsToday: raw.requestsToday,
    requestsThisMonth: raw.requestsThisMonth,
    estimatedTokensToday: raw.estimatedTokensToday,
    dailyCap: dayCap,
    monthlyCap: monthCap,
    blocked: blockedDay || blockedMonth,
    blockReason: blockedDay
      ? `Daily safety cap reached (${raw.requestsToday}/${dayCap}). Resets at midnight IST.`
      : blockedMonth
        ? `Monthly safety cap reached (${raw.requestsThisMonth}/${monthCap}).`
        : undefined,
  };
}

export async function reserve(estimatedTokens: number): Promise<{ ok: boolean; reason?: string }> {
  const usage = await readUsage();
  if (usage.blocked) return { ok: false, reason: usage.blockReason };
  const repo = await getRepository();
  await repo.incrementUsage(todayKey(), monthKey(), estimatedTokens);
  return { ok: true };
}

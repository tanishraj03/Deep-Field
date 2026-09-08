import { config } from "@/lib/config";
import { GeminiFreeProvider, QuotaExhausted, PaidModelBlocked } from "./gemini";
import { RulesProvider } from "./rules";
import type { AIProvider } from "./provider";
import { readUsage } from "./usage";

export * from "./provider";
export { QuotaExhausted, PaidModelBlocked, readUsage };

let cached: AIProvider | null = null;

/**
 * Returns the AI provider for this process.
 *
 * There is exactly one paid-provider escape hatch in this codebase: none.
 * If Gemini is unusable for any reason we drop to deterministic rules —
 * we never "upgrade" to keep the feature working.
 */
export async function getAIProvider(): Promise<{ provider: AIProvider; degraded: boolean; reason?: string }> {
  if (cached) return { provider: cached, degraded: cached.id === "rules" };

  if (!config.gemini.apiKey) {
    cached = new RulesProvider();
    return { provider: cached, degraded: true, reason: "No GEMINI_API_KEY set. Running on deterministic rules." };
  }

  const usage = await readUsage();
  if (usage.blocked) {
    cached = new RulesProvider();
    return { provider: cached, degraded: true, reason: usage.blockReason };
  }

  const gemini = new GeminiFreeProvider();
  if (await gemini.available()) {
    cached = gemini;
    return { provider: gemini, degraded: false };
  }

  cached = new RulesProvider();
  return { provider: cached, degraded: true, reason: "Gemini unreachable or model unavailable on the free tier." };
}

export function resetProviderCache() { cached = null; }

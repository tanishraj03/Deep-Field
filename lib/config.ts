// Single source of truth for "is this allowed to cost money?".
// Read this file first when auditing cost. Nothing else may call a paid provider.

function bool(v: string | undefined, dflt: boolean) {
  if (v === undefined || v === "") return dflt;
  return v.toLowerCase() === "true" || v === "1";
}
function num(v: string | undefined, dflt: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

export const config = {
  freeOnly: bool(process.env.FREE_ONLY, true),
  mockData: bool(process.env.MOCK_DATA, !process.env.GEMINI_API_KEY),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
  },

  ai: {
    maxPerDay: num(process.env.AI_MAX_REQUESTS_PER_DAY, 180),
    maxPerMonth: num(process.env.AI_MAX_REQUESTS_PER_MONTH, 4000),
    /** Stop at this fraction of the cap so we never brush the real quota. */
    safetyThreshold: Math.min(0.95, num(process.env.AI_SAFETY_THRESHOLD, 0.8)),
    /** Hard ceiling on how many items ever reach the model in one run. */
    maxItemsPerRun: 24,
  },

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
    channelLabel: process.env.SLACK_CHANNEL_LABEL || "#intelligence",
  },

  cronSecret: process.env.CRON_SECRET ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  briefHourIst: num(process.env.BRIEF_HOUR_IST, 8),

  ingestion: {
    perSourceTimeoutMs: 9000,
    maxConcurrent: 6,
    userAgent:
      "DailyIntelligenceCentre/1.0 (+https://github.com/; personal research reader; contact via repo)",
    /** Politeness. We read public feeds at a walking pace, once a day. */
    minDelayPerHostMs: 400,
    lookbackDays: 7,
  },
} as const;

/**
 * Models that are paid-only on the Gemini API in 2026 (Pro tier and above).
 * Under FREE_ONLY these are refused before a request is ever built.
 */
const PAID_MODEL_MARKERS = ["-pro", "ultra", "3-pro", "pro-preview"];

export function isFreeTierModel(model: string): boolean {
  const m = model.toLowerCase();
  if (PAID_MODEL_MARKERS.some((p) => m.includes(p))) return false;
  return m.includes("flash") || m.includes("lite") || m.includes("nano");
}

export type BlockedService = { service: string; reason: string };

/** Anything that could produce an invoice gets listed here and is then unreachable. */
export function auditForPaidServices(): BlockedService[] {
  const blocked: BlockedService[] = [];
  if (!config.freeOnly) return blocked;
  if (config.gemini.model && !isFreeTierModel(config.gemini.model)) {
    blocked.push({
      service: `Gemini model "${config.gemini.model}"`,
      reason: "Pro/Ultra tier models are paid-only. Set GEMINI_MODEL to a Flash or Flash-Lite model.",
    });
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (/^(OPENAI|ANTHROPIC|CLAUDE)_API_KEY$/.test(k)) {
      blocked.push({ service: k, reason: "Paid LLM provider. Never used by this app." });
    }
  }
  return blocked;
}

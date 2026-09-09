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
    model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
    /**
     * A stronger free model, used only where one call buys a lot: THE SIGNAL,
     * the brief sections and the content buckets. Per-item interpretation stays
     * on the fast model because it runs forty times and the paced clock is the
     * binding constraint there.
     *
     * Measured on the buckets prompt: 3.5-flash returns 4 well-reasoned buckets
     * in ~7s against flash-lite's 3 thinner ones in ~1.8s.
     */
    deepModel: process.env.GEMINI_MODEL_DEEP || "gemini-3.5-flash",
    /**
     * Thinking is disabled on the deep model. Left on, it spent ~1085 tokens
     * reasoning before writing and truncated the JSON mid-object — the response
     * failed to parse and the whole section fell back to rules. Off, the same
     * model answers correctly and faster.
     */
    disableThinking: bool(process.env.GEMINI_DISABLE_THINKING, true),
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
  },

  ai: {
    maxPerDay: num(process.env.AI_MAX_REQUESTS_PER_DAY, 1000),
    maxPerMonth: num(process.env.AI_MAX_REQUESTS_PER_MONTH, 25000),
    /** Stop at this fraction of the cap so we never brush the real quota. */
    safetyThreshold: Math.min(0.95, num(process.env.AI_SAFETY_THRESHOLD, 0.8)),
    /** Hard ceiling on how many items ever reach the model in one run. */
    maxItemsPerRun: num(process.env.AI_MAX_ITEMS_PER_RUN, 40),
    /**
     * Minimum spacing between model calls, in ms. The free tier limits
     * requests per minute, not just per day, so the daily cap alone never
     * protected a run. 4s ≈ 15 requests/minute.
     */
    minGapMs: num(process.env.AI_MIN_GAP_MS, 4000),
    /** Longest single backoff we will honour after a 429 before giving up. */
    maxBackoffMs: num(process.env.AI_MAX_BACKOFF_MS, 30_000),
    /**
     * Wall-clock budget for the interpretation stage.
     *
     * Pacing calls to respect requests-per-minute means 40 items take about
     * 160s, and a Vercel Hobby function is killed at 60. Rather than being
     * cut off mid-run and losing the whole response, the loop stops early and
     * reports how many items it managed — reduced coverage, stated plainly.
     * Generous locally and in GitHub Actions, where nothing kills the process.
     */
    maxWallClockMs: num(process.env.AI_MAX_WALL_CLOCK_MS, process.env.VERCEL ? 40_000 : 600_000),
  },

  /**
   * YouTube Data API v3 — free tier, 10,000 units/day, no billing account.
   * Optional: with no key the top-performing-video sources simply report
   * themselves unavailable, like any other feed that cannot be reached.
   */
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY ?? "",
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

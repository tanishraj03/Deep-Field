// Every environment variable the app reads, in one place.
// Every key is optional. With none set the app still scans Reddit (via the
// Arctic Shift archive), Hacker News, news volume (GDELT), Wikipedia, Google
// Trends, Bluesky and Mastodon — AI interpretation and YouTube need keys.

function num(v: string | undefined, dflt: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

export const config = {
  /** API keys for the assistant's model providers. See lib/ai/models.ts. */
  keys: {
    gemini: process.env.GEMINI_API_KEY ?? "",
    groq: process.env.GROQ_API_KEY ?? "",
    cerebras: process.env.CEREBRAS_API_KEY ?? "",
    openrouter: process.env.OPENROUTER_API_KEY ?? "",
    mistral: process.env.MISTRAL_API_KEY ?? "",
    xai: process.env.XAI_API_KEY ?? "",
  },

  ai: {
    /**
     * The model used for background work — clustering a scan into topics and
     * writing the insight on Explore. A model id from lib/ai/models.ts. When
     * unset, the first free model with a key wins. Grok is never chosen
     * automatically because it bills credits.
     */
    backgroundModel: process.env.AI_BACKGROUND_MODEL ?? "",
    /** Default model in the assistant's picker. */
    defaultChatModel: process.env.AI_DEFAULT_MODEL ?? "",
  },

  /**
   * Reddit's own API. Optional. With it, conversations carry live upvote and
   * comment counts the moment they are posted; without it, counts come from
   * the Arctic Shift archive and settle about a day and a half after posting.
   * Create a "script" app at https://www.reddit.com/prefs/apps.
   */
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID ?? "",
    clientSecret: process.env.REDDIT_CLIENT_SECRET ?? "",
    userAgent: process.env.REDDIT_USER_AGENT || "web:deep-field:2.0 (personal content research)",
  },

  /** YouTube Data API v3. Free, 10,000 units/day. Optional. */
  youtube: { apiKey: process.env.YOUTUBE_API_KEY ?? "" },

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },

  /** Lets the scheduler skip the per-niche cooldown. */
  cronSecret: process.env.CRON_SECRET ?? "",

  scan: {
    /** A niche is not re-scanned from the interface more often than this. */
    cooldownMs: num(process.env.SCAN_COOLDOWN_MS, 10 * 60_000),
    /** How long an Explore result is reused before searching again. */
    exploreTtlMs: num(process.env.EXPLORE_TTL_MS, 3 * 60 * 60_000),
  },

  http: {
    timeoutMs: 12_000,
    userAgent: "deep-field/2.0 (personal content research; +https://github.com)",
  },
} as const;

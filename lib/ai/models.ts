import { config } from "@/lib/config";

/**
 * Every model the assistant can switch between.
 *
 * All six providers speak the OpenAI chat-completions dialect, so one client
 * drives them all (lib/ai/client.ts). Free-tier rosters change month to month,
 * so each entry lists candidate ids in order of preference and the first one
 * the provider's live /models list still offers is used. Nothing breaks when a
 * provider retires an id, the next candidate takes over.
 */

export type ProviderId = "gemini" | "groq" | "cerebras" | "openrouter" | "mistral" | "xai";

export interface Provider {
  id: ProviderId;
  name: string;
  baseUrl: string;
  keyEnv: string;
  keyUrl: string;
  /** Plain statement of what it costs. */
  pricing: string;
  free: boolean;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  gemini: {
    id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyEnv: "GEMINI_API_KEY", keyUrl: "https://aistudio.google.com/apikey",
    pricing: "Free tier, no card needed", free: true,
  },
  groq: {
    id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1",
    keyEnv: "GROQ_API_KEY", keyUrl: "https://console.groq.com/keys",
    pricing: "Free tier, roughly 30 requests/min", free: true,
  },
  cerebras: {
    id: "cerebras", name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1",
    keyEnv: "CEREBRAS_API_KEY", keyUrl: "https://cloud.cerebras.ai",
    pricing: "Free tier, about 1M tokens/day", free: true,
  },
  openrouter: {
    id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1",
    keyEnv: "OPENROUTER_API_KEY", keyUrl: "https://openrouter.ai/keys",
    pricing: "Free \":free\" models, 50 requests/day", free: true,
  },
  mistral: {
    id: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1",
    keyEnv: "MISTRAL_API_KEY", keyUrl: "https://console.mistral.ai/api-keys",
    pricing: "Free Experiment plan (phone verification)", free: true,
  },
  xai: {
    id: "xai", name: "xAI Grok", baseUrl: "https://api.x.ai/v1",
    keyEnv: "XAI_API_KEY", keyUrl: "https://console.x.ai",
    pricing: "Paid, billed to your xAI credits", free: false,
  },
};

export interface ModelSlot {
  id: string;
  provider: ProviderId;
  label: string;
  /** Short badges next to the name in the picker. The first is the headline. */
  tags: string[];
  /** One line on when to pick it. */
  bestFor: string;
  candidates: string[];
  /** Accept any free model the provider lists when no candidate survives. */
  anyFree?: boolean;
  /** Free tiers with an 8K context cannot hold a full research scan. */
  smallContext?: boolean;
  /**
   * Sent as reasoning_effort. Gemini 3.5 Flash thinks for ~20s on a
   * three-line prompt by default and ~2s at "low", with no visible loss on
   * this kind of work. Only set where the provider accepts the parameter.
   */
  reasoning?: "low" | "medium";
}

export const MODELS: ModelSlot[] = [
  {
    id: "gemini-flash", provider: "gemini", label: "Gemini Flash",
    tags: ["Best overall", "Free"],
    bestFor: "Deep research: reads whole scans, reliable tool use, 1M context",
    // gemini-flash-latest is deliberately absent: it timed out at 60s in testing.
    candidates: ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"],
    reasoning: "low",
  },
  {
    id: "gemini-flash-lite", provider: "gemini", label: "Gemini Flash-Lite",
    tags: ["Highest free limits", "Free"],
    bestFor: "Quick questions when you are chatting a lot",
    candidates: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"],
    reasoning: "low",
  },
  // Groq retired its Llama models in 2026; Qwen is its fast general model now.
  {
    id: "groq-qwen", provider: "groq", label: "Qwen 3.8 · Groq",
    tags: ["Fastest", "Free"],
    bestFor: "Instant answers and brainstorming hooks",
    candidates: ["qwen/qwen3.8-27b"],
  },
  {
    id: "groq-gpt-oss", provider: "groq", label: "GPT-OSS 120B · Groq",
    tags: ["Best free reasoning", "Free"],
    bestFor: "Working through 'why is this trending' and comparing angles",
    candidates: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    reasoning: "low",
  },
  {
    id: "cerebras", provider: "cerebras", label: "Cerebras",
    tags: ["Ultra-fast", "Free"],
    bestFor: "Very fast drafts. Free context is short, so keep scans small",
    candidates: ["gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507", "llama-3.3-70b", "zai-glm-4.7", "llama3.1-8b"],
    smallContext: true,
  },
  {
    id: "openrouter-free", provider: "openrouter", label: "OpenRouter Free",
    tags: ["Most variety", "Free"],
    bestFor: "DeepSeek, Qwen, Llama and others free, 50 messages a day",
    candidates: [
      "openai/gpt-oss-120b:free", "deepseek/deepseek-chat-v3.1:free", "qwen/qwen3-235b-a22b:free",
      "meta-llama/llama-3.3-70b-instruct:free", "z-ai/glm-4.5-air:free",
    ],
    anyFree: true,
  },
  {
    id: "mistral", provider: "mistral", label: "Mistral Medium",
    tags: ["Strong writing", "Free"],
    bestFor: "Scripts, captions and polished copy",
    candidates: ["mistral-medium-latest", "mistral-small-latest"],
  },
  {
    id: "grok", provider: "xai", label: "Grok",
    tags: ["Paid", "Sharp on internet culture"],
    bestFor: "Edgy, culture-aware takes. Uses xAI credits",
    candidates: ["grok-4.5", "grok-4.3", "grok-4.1-fast", "grok-4-fast", "grok-4", "grok-3-mini"],
  },
];

export const MODEL_BY_ID = new Map(MODELS.map((m) => [m.id, m]));

export function hasKey(provider: ProviderId): boolean {
  return Boolean(config.keys[provider]);
}

export function apiKey(provider: ProviderId): string {
  return config.keys[provider];
}

/* ───────────── live resolution ───────────── */

interface Listed { id: string; tools: boolean | null }
const listCache = new Map<ProviderId, { at: number; ids: Listed[] }>();
const resolved = new Map<string, string>();

async function providerModels(p: ProviderId): Promise<Listed[]> {
  const hit = listCache.get(p);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.ids;
  try {
    const res = await fetch(`${PROVIDERS[p].baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey(p)}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { id: string; supported_parameters?: string[] }[] };
    const ids = (json.data ?? []).map((m) => ({
      id: m.id.replace(/^models\//, ""),
      tools: m.supported_parameters ? m.supported_parameters.includes("tools") : null,
    }));
    listCache.set(p, { at: Date.now(), ids });
    return ids;
  } catch {
    return [];
  }
}

/** The concrete model id to call for a slot, checked against the live list. */
export async function resolveModel(slot: ModelSlot): Promise<string> {
  const cached = resolved.get(slot.id);
  if (cached) return cached;
  const listed = await providerModels(slot.provider);
  const ids = new Set(listed.map((l) => l.id));
  let pick = slot.candidates.find((c) => ids.has(c));
  if (!pick && slot.anyFree) {
    pick = listed.find((l) => l.id.endsWith(":free") && l.tools !== false)?.id;
  }
  // An empty list means the listing call failed, not that nothing exists , 
  // try the first preference and let the real call report what is wrong.
  pick ??= slot.candidates[0];
  resolved.set(slot.id, pick);
  return pick;
}

/** Forget a resolution after the provider rejected it, so the next call re-resolves. */
export function forgetResolution(slotId: string) {
  resolved.delete(slotId);
  const slot = MODEL_BY_ID.get(slotId);
  if (slot) listCache.delete(slot.provider);
}

export function availableModels(): ModelSlot[] {
  return MODELS.filter((m) => hasKey(m.provider));
}

/**
 * Free models for background work, best first. Background work must never
 * spend money, so paid providers are excluded even when their key is set.
 * Callers walk the list: when one free tier is overloaded (Gemini answers 503
 * at peak) the next one takes the job instead of dropping to keyword rules.
 */
export function backgroundModels(): ModelSlot[] {
  const free = MODELS.filter((m) => hasKey(m.provider) && PROVIDERS[m.provider].free && !m.smallContext);
  const chosen = config.ai.backgroundModel ? free.find((m) => m.id === config.ai.backgroundModel) : undefined;
  return chosen ? [chosen, ...free.filter((m) => m !== chosen)] : free;
}

export function backgroundModel(): ModelSlot | null {
  return backgroundModels()[0] ?? null;
}

export function defaultChatModel(): ModelSlot | null {
  const chosen = config.ai.defaultChatModel && MODEL_BY_ID.get(config.ai.defaultChatModel);
  if (chosen && hasKey(chosen.provider)) return chosen;
  return MODELS.find((m) => hasKey(m.provider) && PROVIDERS[m.provider].free) ?? availableModels()[0] ?? null;
}

/** What the browser is allowed to know: names, tags and whether a key is set. */
export function publicModelList() {
  return MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    tags: m.tags,
    bestFor: m.bestFor,
    provider: m.provider,
    providerName: PROVIDERS[m.provider].name,
    pricing: PROVIDERS[m.provider].pricing,
    free: PROVIDERS[m.provider].free,
    available: hasKey(m.provider),
    keyEnv: PROVIDERS[m.provider].keyEnv,
    keyUrl: PROVIDERS[m.provider].keyUrl,
  }));
}

export type PublicModel = ReturnType<typeof publicModelList>[number];

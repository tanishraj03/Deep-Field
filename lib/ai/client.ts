import { noEmDashDeep } from "@/lib/utils";
import { apiKey, forgetResolution, MODEL_BY_ID, PROVIDERS, resolveModel, type ModelSlot } from "./models";

/**
 * One client for every provider, over the OpenAI chat-completions protocol.
 * No SDKs: each provider is a base URL and a bearer key.
 */

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  /** Provider extras that must be echoed back (Gemini's thought signatures). */
  [extra: string]: unknown;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export class AIError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

function explain(slot: ModelSlot, status: number, body: string): string {
  const p = PROVIDERS[slot.provider];
  if (status === 401 || status === 403) return `${p.name} rejected the API key (${p.keyEnv}). Check it at ${p.keyUrl}.`;
  if (status === 429) return `${p.name}'s free limit is used up for now. Switch to another model, or wait a minute.`;
  if (status === 402) return `${p.name} has no credits left on this key.`;
  if (status === 404) return `${p.name} no longer serves this model. Try again and the next available model will be used.`;
  if (status === 503) return `${p.name} is overloaded right now. Switch to another model, or try again shortly.`;
  const msg = body.match(/"message"\s*:\s*"([^"]{0,220})/)?.[1] ?? body.slice(0, 220);
  return `${p.name} error ${status}: ${msg}`;
}

/** How long a 429 asks us to wait: Retry-After, or Google's RetryInfo detail. */
async function retryAfterMs(res: Response): Promise<number | null> {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  try {
    const text = await res.clone().text();
    const m = text.match(/"retryDelay"\s*:\s*"([\d.]+)s"/) ?? text.match(/try again in ([\d.]+)s/i);
    return m ? Math.round(parseFloat(m[1]) * 1000) : null;
  } catch { return null; }
}

interface RequestOpts {
  messages: ChatMessage[];
  tools?: ToolDef[];
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  stream?: boolean;
  signal?: AbortSignal;
}

async function post(slot: ModelSlot, model: string, o: RequestOpts): Promise<Response> {
  const p = PROVIDERS[slot.provider];
  const body: Record<string, unknown> = {
    model,
    messages: o.messages,
    temperature: o.temperature ?? 0.4,
    max_tokens: o.maxTokens ?? 4096,
    stream: Boolean(o.stream),
  };
  if (slot.reasoning) body.reasoning_effort = slot.reasoning;
  if (o.tools?.length) body.tools = o.tools;
  if (o.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey(slot.provider)}`,
    "Content-Type": "application/json",
  };
  if (slot.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/deep-field";
    headers["X-Title"] = "DeepField";
  }

  const send = (b: Record<string, unknown>) => fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST", headers, body: JSON.stringify(b), signal: o.signal ?? AbortSignal.timeout(120_000),
  });

  let res = await send(body);
  // 503 is "overloaded right now" and usually clears within seconds. A 429
  // says how long to wait; honour that once if it is short. Never loop.
  if (!o.stream && (res.status === 503 || res.status === 429)) {
    const wait = res.status === 503 ? 3000 : await retryAfterMs(res);
    if (wait !== null && wait <= 20_000) {
      await new Promise((r) => setTimeout(r, wait + 250));
      res = await send(body);
    }
  }
  // Some free models refuse JSON mode or tools. Drop the optional part once
  // rather than failing the user's request over it.
  if (res.status === 400 && (body.response_format || body.tools || body.reasoning_effort)) {
    const text = await res.clone().text();
    const retry = { ...body };
    if (body.reasoning_effort && /reason|think/i.test(text)) delete retry.reasoning_effort;
    if (body.response_format && /response_format|json/i.test(text)) delete retry.response_format;
    if (body.tools && /tool|function/i.test(text)) delete retry.tools;
    if (Object.keys(retry).length !== Object.keys(body).length) res = await send(retry);
  }
  if (res.status === 404) forgetResolution(slot.id);
  return res;
}

function slotOf(id: string): ModelSlot {
  const slot = MODEL_BY_ID.get(id);
  if (!slot) throw new AIError(`Unknown model "${id}"`);
  if (!apiKey(slot.provider)) throw new AIError(`${PROVIDERS[slot.provider].keyEnv} is not set.`);
  return slot;
}

/** A single non-streamed completion. */
export async function complete(slotId: string, o: Omit<RequestOpts, "stream">) {
  const slot = slotOf(slotId);
  const model = await resolveModel(slot);
  const res = await post(slot, model, o);
  if (!res.ok) throw new AIError(explain(slot, res.status, await res.text()), res.status);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
  };
  const choice = json.choices?.[0];
  return { content: choice?.message?.content ?? "", toolCalls: choice?.message?.tool_calls ?? [], model };
}

/** Pull the first JSON object out of a reply, tolerating fences and preamble. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(cleaned) as T; } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
  throw new AIError("The model did not return valid JSON");
}

export async function completeJSON<T>(slotId: string, system: string, user: string, maxTokens = 6000) {
  const r = await complete(slotId, {
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    json: true, maxTokens, temperature: 0.3,
  });
  return { data: noEmDashDeep(parseJson<T>(r.content)), model: r.model };
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_calls"; calls: ToolCall[] }
  | { type: "finish"; reason: string; model: string };

/**
 * A streamed completion. Text arrives as it is written; tool calls arrive
 * whole, once their arguments have finished streaming.
 */
export async function* stream(slotId: string, o: Omit<RequestOpts, "stream">): AsyncGenerator<StreamEvent> {
  const slot = slotOf(slotId);
  const model = await resolveModel(slot);
  const res = await post(slot, model, { ...o, stream: true });
  if (!res.ok || !res.body) throw new AIError(explain(slot, res.status, await res.text()), res.status);

  const calls: ToolCall[] = [];
  let finish = "stop";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: {
        choices?: { delta?: { content?: string | null; tool_calls?: (Partial<ToolCall> & { index?: number })[] }; finish_reason?: string | null }[];
        error?: { message?: string };
      };
      try { chunk = JSON.parse(data); } catch { continue; }
      if (chunk.error) throw new AIError(chunk.error.message ?? "Provider stream error");
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.delta?.content) yield { type: "text", delta: choice.delta.content };
      for (const d of choice.delta?.tool_calls ?? []) {
        const i = d.index ?? calls.length;
        const cur = (calls[i] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
        const { index: _i, function: fn, ...extra } = d;
        if (extra.id) cur.id = extra.id as string;
        if (fn?.name) cur.function.name += fn.name;
        if (fn?.arguments) cur.function.arguments += fn.arguments;
        for (const [k, v] of Object.entries(extra)) if (k !== "id" && k !== "type" && v !== undefined) cur[k] = v;
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }
  }

  const complete = calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
  if (complete.length) yield { type: "tool_calls", calls: complete };
  yield { type: "finish", reason: complete.length ? "tool_calls" : finish, model };
}

import type { NextRequest } from "next/server";
import { stream, type ChatMessage, type ToolCall } from "@/lib/ai/client";
import { defaultChatModel, MODEL_BY_ID } from "@/lib/ai/models";
import { assistantSystem, postLine } from "@/lib/ai/prompts";
import { runTool, TOOLS } from "@/lib/ai/tools";
import { cachedExplore } from "@/lib/explore";
import { nicheLabel } from "@/lib/niches";
import { loadScan } from "@/lib/pulse/scan";
import type { RegionFilter } from "@/lib/types";
import { compact, istDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export type ChatContext =
  | { type: "topic"; niche: string; topicId: string }
  | { type: "explore"; query: string; region: RegionFilter };

interface Body {
  model?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  context?: ChatContext;
}

/** The research the chat was opened from, written out for the system prompt. */
async function describeContext(ctx: ChatContext | undefined): Promise<string | undefined> {
  if (!ctx) return undefined;
  if (ctx.type === "topic") {
    const scan = await loadScan(ctx.niche);
    const t = scan?.topics.find((x) => x.id === ctx.topicId);
    if (!scan || !t) return undefined;
    const posts = t.postIds.map((id) => scan.posts.find((p) => p.id === id)).filter((p) => !!p);
    return `Topic "${t.title}" in ${nicheLabel(t.niche)} (heat ${t.heat}/100; ref for tools: ${t.niche}:${t.id}).
${t.summary} ${t.whyNow}
${t.metrics.posts} posts (${t.metrics.postsIN} India / ${t.metrics.postsGLOBAL} global), ${compact(t.metrics.comments)} comments, ${compact(t.metrics.views)} views, ${t.metrics.communities} communities. Sentiment: ${t.sentiment}.
Virality ${t.virality}/100 (~${compact(t.metrics.perHour)} reactions an hour). DeepField verdict: ${t.verdict.call} (${t.verdict.score}/100): ${t.verdict.reasons.join("; ")}.
Threads:
${posts.map((p, i) => `${postLine(p!, i)} · ${p!.url}`).join("\n")}`;
  }
  const r = await cachedExplore(ctx.query, ctx.region);
  if (!r) return `The user was researching "${ctx.query}". Use research_topic to get the data.`;
  return `Research on "${r.query}" (${r.region === "ALL" ? "everywhere" : r.region === "IN" ? "India" : "global"}): ${r.totals.conversations} conversations, ${compact(r.totals.comments)} comments.
${r.opportunity ? `Opportunity: ${r.opportunity.call} (${r.opportunity.score}/100), virality ${r.opportunity.virality}/100: ${r.opportunity.signals.join("; ")}` : ""}
${r.sources.map((s) => `${s.source}: ${s.ok ? `${s.total ?? "?"} in ${s.window}` : "unavailable"}`).join("; ")}
Top communities: ${r.communities.slice(0, 8).map((c) => `${c.name} (${c.posts})`).join(", ")}
Top threads:
${r.posts.slice(0, 20).map((p, i) => `${postLine(p, i)} · ${p.url}`).join("\n")}`;
}

/**
 * The assistant, streamed as newline-delimited JSON events:
 *   {type:"text", delta} · {type:"tool", id, name, args, status, summary?}
 *   {type:"error", message} · {type:"done", model}
 * Tool rounds run here, on the server, so keys never reach the browser.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const slot = (body.model && MODEL_BY_ID.get(body.model)) || defaultChatModel();
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      if (!slot) {
        send({ type: "error", message: "No AI model has a key yet. Add GEMINI_API_KEY (free at aistudio.google.com/apikey) to .env.local." });
        controller.close();
        return;
      }

      try {
        const context = await describeContext(body.context);
        const messages: ChatMessage[] = [
          { role: "system", content: assistantSystem(istDate(), context) },
          ...body.messages.slice(-20).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        ];
        // Short-context free tiers cannot hold a full research payload.
        const maxToolChars = slot.smallContext ? 3500 : 14000;
        let model = "";

        for (let round = 0; round < 5; round++) {
          let text = "";
          let calls: ToolCall[] = [];
          for await (const ev of stream(slot.id, {
            messages,
            tools: round < 4 ? TOOLS : undefined,
            maxTokens: 4096,
            temperature: 0.5,
            signal: req.signal,
          })) {
            if (ev.type === "text") { text += ev.delta; send({ type: "text", delta: ev.delta }); }
            else if (ev.type === "tool_calls") calls = ev.calls;
            else if (ev.type === "finish") model = ev.model;
          }
          if (!calls.length) break;

          messages.push({ role: "assistant", content: text || null, tool_calls: calls });
          for (const call of calls) {
            send({ type: "tool", id: call.id, name: call.function.name, args: call.function.arguments, status: "running" });
            const out = await runTool(call.function.name, call.function.arguments, maxToolChars);
            send({ type: "tool", id: call.id, name: call.function.name, args: call.function.arguments, status: out.ok ? "done" : "failed", summary: out.summary });
            messages.push({ role: "tool", tool_call_id: call.id, content: out.content });
          }
          if (text) send({ type: "text", delta: "\n\n" });
        }
        send({ type: "done", model, label: slot.label });
      } catch (e) {
        if (!req.signal.aborted) send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Check, Loader2, MessageSquarePlus, Search, Sparkles, Square, Trash2, TrendingUp, X, BookOpen, MessagesSquare } from "lucide-react";
import type { PublicModel } from "@/lib/ai/models";
import type { RegionFilter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { ModelPicker } from "./model-picker";

type ChatContext =
  | { type: "topic"; niche: string; topicId: string }
  | { type: "explore"; query: string; region: RegionFilter };

interface ToolStep { id: string; name: string; args: string; status: "running" | "done" | "failed"; summary?: string }
interface Message { role: "user" | "assistant"; content: string; tools?: ToolStep[]; model?: string; error?: string }
interface Chat { id: string; title: string; updatedAt: number; context?: ChatContext; contextLabel?: string; messages: Message[] }

const STORE = "df-chats";
const MODEL_KEY = "df-model";

function loadChats(): Chat[] {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "[]"); } catch { return []; }
}
function saveChats(chats: Chat[]) {
  try { localStorage.setItem(STORE, JSON.stringify(chats.slice(0, 50))); } catch {}
}

const TOOL_LABEL: Record<string, { icon: React.ElementType; running: string }> = {
  get_trending: { icon: TrendingUp, running: "Reading the latest scan" },
  research_topic: { icon: Search, running: "Searching Reddit, HN, YouTube, news and Wikipedia" },
  read_thread: { icon: BookOpen, running: "Reading the thread" },
  whats_being_said: { icon: MessagesSquare, running: "Reading what people are saying" },
};

function toolArgsLabel(step: ToolStep) {
  try {
    const a = JSON.parse(step.args || "{}");
    return a.query ? `“${a.query}”` : a.niche ? a.niche : a.url ? "thread" : "";
  } catch { return ""; }
}

const STARTERS = [
  { title: "What is India talking about today?", prompt: "What are the biggest conversations in India right now across all niches? Rank the top 8 and tell me which are worth making content on." },
  { title: "Find me content gaps", prompt: "Look at what's trending across niches and find 5 conversations with lots of discussion but where the angle nobody is covering yet is obvious. Give me hooks." },
  { title: "Research a topic", prompt: "Research what people are saying about creatine this week, in India and globally. How big is the conversation and what are the main debates?" },
  { title: "Compare two niches", prompt: "Compare what's trending in Money & Investing vs Careers & Work this week. Where is the overlap I can make content about?" },
];

const CONTEXT_STARTERS = [
  "Why is this blowing up right now?",
  "Give me 5 hooks for Reels and Shorts",
  "What's the India angle on this?",
  "What are people actually saying in the comments?",
];

export function Assistant({ models, defaultModel, initialContext, contextLabel }: {
  models: PublicModel[]; defaultModel: string | null; initialContext: ChatContext | null; contextLabel: string | null;
}) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(defaultModel);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Restore history and model; open a fresh chat if we arrived with context.
  useEffect(() => {
    const saved = loadChats();
    const m = localStorage.getItem(MODEL_KEY);
    if (m && models.some((x) => x.id === m && x.available)) setModel(m);
    if (initialContext) {
      const chat: Chat = { id: crypto.randomUUID(), title: contextLabel ?? "New research", updatedAt: Date.now(), context: initialContext, contextLabel: contextLabel ?? undefined, messages: [] };
      setChats([chat, ...saved]);
      setActiveId(chat.id);
      router.replace("/assistant", { scroll: false });
    } else {
      setChats(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (chats.length) saveChats(chats.filter((c) => c.messages.length)); }, [chats]);

  const active = chats.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages]);

  const pickModel = (id: string) => { setModel(id); try { localStorage.setItem(MODEL_KEY, id); } catch {} };

  const patchChat = useCallback((id: string, fn: (c: Chat) => Chat) => {
    setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const patchLast = useCallback((id: string, fn: (m: Message) => Message) => {
    patchChat(id, (c) => ({ ...c, messages: [...c.messages.slice(0, -1), fn(c.messages[c.messages.length - 1])] }));
  }, [patchChat]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    let chat = active;
    if (!chat) {
      chat = { id: crypto.randomUUID(), title: content.slice(0, 60), updatedAt: Date.now(), messages: [] };
      setChats((cs) => [chat!, ...cs]);
      setActiveId(chat.id);
    }
    const id = chat.id;
    const history = [...chat.messages, { role: "user" as const, content }];
    patchChat(id, (c) => ({
      ...c,
      title: c.messages.length ? c.title : c.contextLabel ? c.title : content.slice(0, 60),
      updatedAt: Date.now(),
      messages: [...history, { role: "assistant", content: "", tools: [] }],
    }));
    setInput("");
    setBusy(true);
    abort.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: abort.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          context: chat.context,
          messages: history.filter((m) => m.content).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") patchLast(id, (m) => ({ ...m, content: m.content + ev.delta }));
          else if (ev.type === "tool") {
            patchLast(id, (m) => {
              const tools = [...(m.tools ?? [])];
              const at = tools.findIndex((t) => t.id === ev.id);
              const step = { id: ev.id, name: ev.name, args: ev.args, status: ev.status, summary: ev.summary };
              if (at >= 0) tools[at] = step; else tools.push(step);
              return { ...m, tools };
            });
          } else if (ev.type === "error") patchLast(id, (m) => ({ ...m, error: ev.message }));
          else if (ev.type === "done") patchLast(id, (m) => ({ ...m, model: ev.label ? `${ev.label}${ev.model ? ` · ${ev.model}` : ""}` : ev.model }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") patchLast(id, (m) => ({ ...m, error: (e as Error).message }));
    } finally {
      setBusy(false);
      abort.current = null;
      textarea.current?.focus();
    }
  };

  const newChat = () => { setActiveId(null); setInput(""); textarea.current?.focus(); };
  const removeChat = (id: string) => {
    setChats((cs) => {
      const next = cs.filter((c) => c.id !== id);
      saveChats(next);
      return next;
    });
    if (activeId === id) setActiveId(null);
  };

  const noModels = !models.some((m) => m.available);

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] lg:h-dvh">
      {/* History */}
      <aside className="hidden w-64 shrink-0 flex-col border-r p-3 xl:flex">
        <button onClick={newChat} className="press flex items-center gap-2 rounded-xl px-3 py-2 text-[0.8125rem] font-medium ring-1 ring-hair/10 hover:bg-hair/[0.04]">
          <MessageSquarePlus className="h-4 w-4" />New chat
        </button>
        <p className="eyebrow mt-5 px-3">History</p>
        <div className="mt-1.5 flex-1 space-y-0.5 overflow-y-auto">
          {chats.filter((c) => c.messages.length || c.id === activeId).map((c) => (
            <div key={c.id} className={cn("group flex items-center rounded-lg", c.id === activeId ? "bg-hair/[0.07]" : "hover:bg-hair/[0.04]")}>
              <button onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 truncate px-3 py-1.5 text-left text-[0.8125rem] text-muted group-hover:text-ink">
                {c.title}
              </button>
              <button onClick={() => removeChat(c.id)} aria-label="Delete chat" className="mr-1 rounded p-1 text-faint opacity-0 hover:text-ink group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {!chats.some((c) => c.messages.length) && <p className="px-3 py-2 text-xs text-faint">Chats are saved in this browser.</p>}
        </div>
      </aside>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2.5 xl:hidden">
          <span className="truncate text-sm font-medium">{active?.title ?? "Assistant"}</span>
          <button onClick={newChat} className="flex items-center gap-1.5 text-xs text-muted hover:text-ink"><MessageSquarePlus className="h-4 w-4" />New</button>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            {!active?.messages.length ? (
              <Welcome
                context={active?.contextLabel ?? null}
                onPick={(p) => send(p)}
                noModels={noModels}
              />
            ) : (
              <div className="space-y-7">
                {active.contextLabel && <ContextChip label={active.contextLabel} />}
                {active.messages.map((m, i) => <MessageView key={i} m={m} streaming={busy && i === active.messages.length - 1} />)}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="px-4 pb-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="card p-2 shadow-[0_8px_30px_-18px_rgb(0_0_0/0.35)] focus-within:ring-1 focus-within:ring-accent/40">
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                rows={1}
                placeholder={active?.contextLabel ? `Ask about “${active.contextLabel}”…` : "Ask what the internet is saying about anything…"}
                className="max-h-48 min-h-[2.75rem] w-full resize-none bg-transparent px-2.5 py-2 text-[0.95rem] outline-none placeholder:text-faint"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              <div className="flex items-center justify-between">
                <ModelPicker models={models} value={model} onChange={pickModel} />
                {busy ? (
                  <button onClick={() => abort.current?.abort()} aria-label="Stop" className="press flex h-8 w-8 items-center justify-center rounded-full bg-ink text-canvas">
                    <Square className="h-3 w-3 fill-current" />
                  </button>
                ) : (
                  <button onClick={() => send(input)} disabled={!input.trim() || noModels} aria-label="Send"
                    className="press flex h-8 w-8 items-center justify-center rounded-full bg-ink text-canvas transition disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-center text-[0.6875rem] text-faint">The assistant pulls live counts with its tools. Check anything you publish against the linked threads.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextChip({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent/[0.07] px-3 py-2 text-[0.8125rem]">
      <Sparkles className="h-3.5 w-3.5 text-accent" />
      <span className="text-muted">Researching</span>
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}

function Welcome({ context, onPick, noModels }: { context: string | null; onPick: (p: string) => void; noModels: boolean }) {
  return (
    <div className="pt-[6vh] duration-500 animate-in fade-in slide-in-from-bottom-2">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-canvas">
        <Sparkles className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-[1.625rem] font-semibold tracking-tight">
        {context ? "What do you want to know?" : "What should we make content about?"}
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-muted">
        {context
          ? <>Ask anything about <span className="font-medium text-ink">{context}</span>. I can pull fresh counts, read the threads and draft angles.</>
          : "I can read the latest scan, search any topic across Reddit, Hacker News, YouTube, news and Wikipedia, and read the threads behind the numbers."}
      </p>
      {noModels && (
        <div className="mt-5 rounded-xl bg-ember/[0.08] p-3.5 text-sm">
          No model has a key yet. Add <code className="rounded bg-hair/10 px-1">GEMINI_API_KEY</code> (free at aistudio.google.com/apikey) to <code className="rounded bg-hair/10 px-1">.env.local</code> and restart.
        </div>
      )}
      <div className="mt-7 grid gap-2 sm:grid-cols-2">
        {(context ? CONTEXT_STARTERS.map((p) => ({ title: p, prompt: p })) : STARTERS).map((s) => (
          <button key={s.title} onClick={() => onPick(s.prompt)} disabled={noModels}
            className="card card-hover press p-3.5 text-left text-[0.875rem] disabled:opacity-50">
            <span className="font-medium">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageView({ m, streaming }: { m: Message; streaming: boolean }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-hair/[0.07] px-4 py-2.5 text-[0.95rem]">{m.content}</div>
      </div>
    );
  }
  const thinking = streaming && !m.content && !(m.tools?.some((t) => t.status === "running"));
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {m.tools?.map((t) => {
          const meta = TOOL_LABEL[t.name] ?? { icon: Search, running: t.name };
          return (
            <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 text-[0.8125rem] text-muted">
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg",
                t.status === "failed" ? "bg-fall/10 text-fall" : "bg-hair/[0.06]")}>
                {t.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : t.status === "failed" ? <X className="h-3.5 w-3.5" />
                  : <Check className="h-3.5 w-3.5 text-rise" />}
              </span>
              <meta.icon className="h-3.5 w-3.5 text-faint" />
              <span className="truncate">
                {t.status === "running" ? `${meta.running} ${toolArgsLabel(t)}…` : t.summary}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {thinking && (
        <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-faint"
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </div>
      )}
      {m.content && <Markdown text={m.content} />}
      {m.error && <div className="rounded-xl bg-fall/[0.08] px-3.5 py-2.5 text-sm text-fall">{m.error}</div>}
      {m.model && !streaming && <p className="text-[0.6875rem] text-faint">{m.model}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowBigUp, ArrowRight, ChevronDown, ExternalLink, MessageSquare, MessagesSquare, Quote, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type { Comment, CommentThread, Discussion, RegionFilter, VoicePick } from "@/lib/types";
import { cn, compact, relativeTime } from "@/lib/utils";
import { commentIndex } from "@/lib/view";
import { Badge, Button, Card, Eyebrow, Flag, Segmented, Skeleton, SOURCE_META } from "./ui";

/* ───────────── Data ───────────── */

export type DiscussionSubject = { topic: string } | { q: string; region: RegionFilter };

export interface DiscussionState {
  data: Discussion | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Reads a discussion once per subject; the server caches it, so revisits are instant. */
export function useDiscussion(subject: DiscussionSubject | null): DiscussionState {
  const [data, setData] = useState<Discussion | null>(null);
  // Starts "loading" so the first paint shows progress, not an empty card.
  const [loading, setLoading] = useState(Boolean(subject));
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);
  const qs = subject
    ? "topic" in subject ? `topic=${encodeURIComponent(subject.topic)}` : `q=${encodeURIComponent(subject.q)}&region=${subject.region}`
    : null;

  const load = useCallback(async (fresh: boolean) => {
    if (!qs) return;
    const id = ++req.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/discussion?${qs}${fresh ? "&fresh=1" : ""}`);
      const json = await res.json();
      if (id !== req.current) return;
      if (!json.ok) throw new Error(json.error);
      setData(json.discussion);
    } catch (e) {
      if (id === req.current) setError((e as Error).message);
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [qs]);

  useEffect(() => { setData(null); load(false); }, [load]);
  return { data, loading, error, refresh: () => load(true) };
}

/** The single most telling comment under each thread: the analyst's pick, else its top comment. */
export function bestCommentByPost(d: Discussion | null): Map<string, Comment> {
  const out = new Map<string, Comment>();
  if (!d) return out;
  const index = commentIndex(d);
  for (const p of d.picks) {
    const c = index.get(p.commentId);
    if (c && !out.has(c.postId)) out.set(c.postId, c);
  }
  // Unpicked threads fall back to their top comment that says something, not a one-liner.
  for (const t of d.threads) {
    const c = t.comments.find((x) => x.text.length >= 60) ?? t.comments[0];
    if (!out.has(t.postId) && c) out.set(t.postId, c);
  }
  return out;
}

/* ───────────── Pieces ───────────── */

const ROLE: Record<VoicePick["role"], { label: string; tone: "accent" | "fall" | "rise" | "neutral" | "outline" | "ember" }> = {
  driver: { label: "Why it's spreading", tone: "accent" },
  pushback: { label: "Pushback", tone: "fall" },
  insider: { label: "First-hand", tone: "rise" },
  question: { label: "Question", tone: "neutral" },
  evidence: { label: "Evidence", tone: "outline" },
  mood: { label: "Crowd mood", tone: "ember" },
};

const votesLabel = (c: Comment) => (c.source === "reddit" ? "upvotes" : "likes");

/** A one-line quote under a thread: the comment that best explains it. */
export function InlineQuote({ comment }: { comment: Comment }) {
  return (
    <a href={comment.url} target="_blank" rel="noreferrer"
      className="mt-1.5 flex gap-2 rounded-lg py-1 text-[0.8125rem] leading-snug text-muted hover:text-ink">
      <Quote className="mt-0.5 h-3 w-3 shrink-0 text-faint" />
      <span className="line-clamp-2">
        {comment.text}
        {comment.score !== undefined && <span className="num ml-1.5 text-[0.6875rem] text-faint">↑{compact(comment.score)}</span>}
      </span>
    </a>
  );
}

export function VoiceCard({ comment, pick, thread, parent, compactView }: {
  comment: Comment; pick?: VoicePick; thread?: CommentThread; parent?: Comment; compactView?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const long = comment.text.length > (compactView ? 200 : 360);
  const m = SOURCE_META[comment.source];

  return (
    <div className="rounded-xl bg-hair/[0.035] p-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-muted">
        {pick?.why && <Badge tone={ROLE[pick.role].tone}>{ROLE[pick.role].label}</Badge>}
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
          {thread?.community ?? m.label}
        </span>
        {comment.author && <span className="truncate text-faint">{comment.source === "reddit" ? `u/${comment.author}` : comment.author}</span>}
        <span className="ml-auto flex items-center gap-2.5">
          {comment.score !== undefined && (
            <span className="flex items-center gap-0.5" title={`${comment.score.toLocaleString("en-US")} ${votesLabel(comment)}`}>
              <ArrowBigUp className="h-3.5 w-3.5 text-faint" /><span className="num">{compact(comment.score)}</span>
            </span>
          )}
          {!!comment.replyCount && (
            <span className="flex items-center gap-1" title={`${comment.replyCount} replies`}>
              <MessageSquare className="h-3 w-3 text-faint" /><span className="num">{compact(comment.replyCount)}</span>
            </span>
          )}
          <a href={comment.url} target="_blank" rel="noreferrer" aria-label="Open on the platform" className="text-faint hover:text-ink">
            <ExternalLink className="h-3 w-3" />
          </a>
        </span>
      </div>

      {thread && !compactView && thread.source !== "bluesky" && (
        <p className="mt-1.5 line-clamp-1 text-[0.6875rem] text-faint">on “{thread.title}”</p>
      )}
      {parent && (
        <p className="mt-2 line-clamp-1 border-l-2 border-hair/15 pl-2 text-xs text-faint">Replying to: {parent.text}</p>
      )}

      <p className={cn("mt-2 whitespace-pre-line text-[0.875rem] leading-relaxed", !open && (compactView ? "line-clamp-3" : "line-clamp-6"))}>
        {comment.text}
      </p>
      {long && (
        <button onClick={() => setOpen((v) => !v)} className="mt-1 text-xs font-medium text-muted hover:text-ink">
          {open ? "Show less" : "Show more"}
        </button>
      )}

      {pick?.why && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          <span className="font-medium text-accent">Why it matters · </span>{pick.why}
        </p>
      )}

      {comment.replies.length > 0 && (
        <div className="mt-2.5">
          <button onClick={() => setShowReplies((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
            <ChevronDown className={cn("h-3 w-3 transition-transform", showReplies && "rotate-180")} />
            {showReplies ? "Hide replies" : `${comment.replies.length} top ${comment.replies.length === 1 ? "reply" : "replies"}`}
          </button>
          {showReplies && (
            <div className="mt-2 space-y-2 border-l-2 border-hair/10 pl-3">
              {comment.replies.map((r) => (
                <div key={r.id} className="text-[0.8125rem] leading-relaxed">
                  <p className="flex items-center gap-2 text-[0.6875rem] text-faint">
                    {r.author}{r.score !== undefined && <span className="num">↑{compact(r.score)}</span>}
                  </p>
                  <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-ink/85">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-2 text-xs text-muted"><MessagesSquare className="h-3.5 w-3.5 animate-pulse" />Reading the comments…</p>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-24" />)}
    </div>
  );
}

function Failed({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="text-sm text-muted">
      <p className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-ember" />{error}</p>
      <Button size="sm" className="mt-3" onClick={onRetry}>Try again</Button>
    </div>
  );
}

/* ───────────── Overview card ───────────── */

/** The three most revealing comments, for an overview. */
export function TopComments({ state, onOpenAll }: { state: DiscussionState; onOpenAll: () => void }) {
  const { data, loading, error, refresh } = state;
  const index = useMemo(() => (data ? commentIndex(data) : new Map<string, Comment>()), [data]);
  const threads = useMemo(() => new Map((data?.threads ?? []).map((t) => [t.postId, t])), [data]);
  const top = (data?.picks ?? []).slice(0, 3).map((p) => ({ p, c: index.get(p.commentId) })).filter((x) => x.c);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <Eyebrow className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" />Top comments</Eyebrow>
        {data && <span className="text-[0.6875rem] text-faint">{data.model ? "picked for relevance" : "by votes"}</span>}
      </div>
      {loading && !data && <Loading rows={2} />}
      {error && !data && <Failed error={error} onRetry={refresh} />}
      {data && (
        top.length ? (
          <div className="space-y-2">
            {top.map(({ p, c }) => <VoiceCard key={p.commentId} comment={c!} pick={p} thread={threads.get(c!.postId)} compactView />)}
            <button onClick={onOpenAll} className="flex items-center gap-1 pt-1 text-xs font-medium text-muted hover:text-accent">
              Everything people are saying <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ) : <p className="text-sm text-muted">{data.note ?? "No comments to show yet."}</p>
      )}
    </Card>
  );
}

/* ───────────── The full tab ───────────── */

type View = "highlights" | "themes" | "threads";

export function VoicesPanel({ state }: { state: DiscussionState }) {
  const { data, loading, error, refresh } = state;
  const [view, setView] = useState<View>("highlights");
  const [role, setRole] = useState<VoicePick["role"] | "all">("all");
  const index = useMemo(() => (data ? commentIndex(data) : new Map<string, Comment>()), [data]);
  const threads = useMemo(() => new Map((data?.threads ?? []).map((t) => [t.postId, t])), [data]);

  if (!data) {
    return (
      <Card className="p-5">
        {loading ? <Loading /> : error ? <Failed error={error} onRetry={refresh} /> : null}
      </Card>
    );
  }

  const read = data.threads.filter((t) => t.ok && t.comments.length);
  const failed = data.threads.filter((t) => !t.ok);
  const onBluesky = read.some((t) => t.source === "bluesky");
  const threadCount = read.length - (onBluesky ? 1 : 0);
  const total = read.reduce((a, t) => a + t.comments.reduce((x, c) => x + 1 + c.replies.length, 0), 0);
  const pickOf = new Map(data.picks.map((p) => [p.commentId, p]));
  const roles = [...new Set(data.picks.filter((p) => p.why).map((p) => p.role))];
  const shown = data.picks.filter((p) => role === "all" || p.role === role);
  const card = (c: Comment, compactView = false) => (
    <VoiceCard key={c.id} comment={c} pick={pickOf.get(c.id)} thread={threads.get(c.postId)}
      parent={c.parentId ? index.get(c.parentId) : undefined} compactView={compactView} />
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-3xl">
            <Eyebrow className="flex items-center gap-1.5"><MessagesSquare className="h-3 w-3" />What people are saying</Eyebrow>
            {data.takeaway
              ? <p className="mt-2 text-[0.95rem] leading-relaxed">{data.takeaway}</p>
              : <p className="mt-2 text-sm text-muted">{data.note ?? "The most upvoted comments across the biggest threads."}</p>}
            <p className="mt-2 text-xs text-faint">
              <span className="num">{total}</span> comments and replies from {threadCount} {threadCount === 1 ? "thread" : "threads"}{onBluesky ? " and Bluesky" : ""}
              {data.model ? <> · picked by {data.model}</> : null} · read {relativeTime(data.fetchedAt)}
            </p>
          </div>
          <Button size="sm" variant="ghost" loading={loading} onClick={refresh}>
            {!loading && <RefreshCw className="h-3.5 w-3.5" />}Refresh
          </Button>
        </div>
        {data.note && data.takeaway && <p className="mt-3 text-xs text-ember">{data.note}</p>}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={view} onChange={setView} layoutId="voices-view" size="sm" options={[
          { value: "highlights", label: <>Most revealing <span className="num opacity-60">{data.picks.length}</span></> },
          ...(data.themes.length ? [{ value: "themes" as const, label: <>Themes <span className="num opacity-60">{data.themes.length}</span></> }] : []),
          { value: "threads", label: <>By thread <span className="num opacity-60">{read.length}</span></> },
        ]} />
        {view === "highlights" && roles.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {(["all", ...roles] as const).map((r) => (
              <button key={r} onClick={() => setRole(r)}
                className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition-colors",
                  role === r ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink")}>
                {r === "all" ? "All" : ROLE[r].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "highlights" && (
        <div className="grid gap-2.5 md:grid-cols-2">
          {shown.map((p) => index.get(p.commentId)).filter((c): c is Comment => !!c).map((c) => card(c))}
        </div>
      )}

      {view === "themes" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.themes.map((t) => (
            <Card key={t.label} className="p-5">
              <p className="font-semibold tracking-tight">{t.label}</p>
              <p className="mt-1 text-sm text-muted">{t.detail}</p>
              <div className="mt-3 space-y-2">
                {t.commentIds.map((id) => index.get(id)).filter((c): c is Comment => !!c).map((c) => card(c, true))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "threads" && (
        <div className="space-y-4">
          {read.map((t) => <ThreadComments key={t.postId} thread={t} card={card} />)}
        </div>
      )}

      {failed.length > 0 && (
        <p className="text-xs text-faint">
          Couldn&apos;t read: {failed.map((t) => `${SOURCE_META[t.source].label} ${t.community} (${t.note})`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function ThreadComments({ thread, card }: { thread: CommentThread; card: (c: Comment, compactView?: boolean) => React.ReactNode }) {
  const [all, setAll] = useState(false);
  const shown = all ? thread.comments : thread.comments.slice(0, 4);
  return (
    <Card className="p-5">
      <a href={thread.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_META[thread.source].color }} aria-hidden />
            {SOURCE_META[thread.source].label}
            {thread.source !== "bluesky" && <> · <Flag region={thread.region} />{thread.community}</>}
          </p>
          <p className="mt-1 line-clamp-2 font-medium leading-snug group-hover:text-accent">{thread.title}</p>
        </div>
        <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-faint group-hover:text-ink" />
      </a>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{shown.map((c) => card(c, true))}</div>
      {thread.comments.length > 4 && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
          {all ? "Show fewer" : `Show all ${thread.comments.length}`}
          <ChevronDown className={cn("h-3 w-3 transition-transform", all && "rotate-180")} />
        </button>
      )}
    </Card>
  );
}

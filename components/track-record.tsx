"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, ExternalLink, Trash2 } from "lucide-react";
import type { Learning } from "@/lib/feedback";
import { OUTCOMES, type Call, type Made, type Outcome } from "@/lib/feedback-shared";
import { nicheLabel } from "@/lib/niches";
import { cn, compact, relativeTime } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Eyebrow, VERDICT_META } from "./ui";

const RESULT_TONE: Record<Outcome, string> = { below: "text-fall", usual: "text-muted", above: "text-rise", viral: "text-accent" };
const isHit = (o: Outcome) => o === "above" || o === "viral";

/** How each kind of call has done, in plain words. */
function rate(made: Made[], call: Call) {
  const done = made.filter((m) => m.topic.call === call && m.outcome);
  return { total: done.length, hits: done.filter((m) => isHit(m.outcome!.result)).length };
}

export function TrackRecord({ initial, community }: {
  initial: Made[];
  community: Pick<Learning, "people" | "reported" | "byCall">;
}) {
  const [made, setMade] = useState(initial);
  const waiting = made.filter((m) => !m.outcome);
  const done = made.filter((m) => m.outcome);

  const post = async (body: object) => {
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error ?? "Couldn't save that.");
    setMade(j.all);
  };

  if (!made.length) {
    return (
      <EmptyState icon={Clapperboard} title="Nothing tracked yet"
        body={<>When you make something on a topic, open it and press <span className="font-medium text-ink">I made this</span>. Come back in a few days to say how it did.</>}
        action={<Link href="/"><Button variant="primary">Find something to make</Button></Link>} />
    );
  }

  return (
    <div className="space-y-8">
      {waiting.length > 0 && (
        <section>
          <Eyebrow className="mb-3">How did these do? · {waiting.length}</Eyebrow>
          <div className="space-y-3">{waiting.map((m) => <Entry key={m.id} m={m} post={post} />)}</div>
        </section>
      )}

      <section>
        <Eyebrow className="mb-3">How DeepField&apos;s calls held up</Eyebrow>
        <Card className="grid gap-px overflow-hidden bg-hair/[0.06] sm:grid-cols-3">
          {(["make", "test", "skip"] as Call[]).map((c) => {
            const mine = rate(made, c);
            const all = community.byCall[c];
            return (
              <div key={c} className="bg-surface/70 p-4">
                <p className="text-sm font-semibold">{VERDICT_META[c].label}</p>
                <p className="num mt-1 text-[1.5rem] font-semibold leading-none">
                  {mine.total ? `${mine.hits}/${mine.total}` : "—"}
                </p>
                <p className="mt-1 text-xs text-muted">{mine.total ? "of yours beat your usual" : "none of yours reported yet"}</p>
                {all.reported >= 3 && (
                  <p className="mt-2 text-[0.6875rem] text-faint">All creators: {all.hits} of {all.reported} beat their usual</p>
                )}
              </div>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-faint">
          {community.reported
            ? `${community.reported} ${community.reported === 1 ? "result" : "results"} reported by creators so far. Once a niche has enough, its verdicts lean towards what actually worked, and the verdict says so.`
            : "No results reported yet. Once a niche has a few, its verdicts start leaning towards what actually worked."}
        </p>
      </section>

      {done.length > 0 && (
        <section>
          <Eyebrow className="mb-3">Reported · {done.length}</Eyebrow>
          <div className="space-y-3">{done.map((m) => <Entry key={m.id} m={m} post={post} />)}</div>
        </section>
      )}
    </div>
  );
}

function Entry({ m, post }: { m: Made; post: (b: object) => Promise<void> }) {
  const [result, setResult] = useState<Outcome | null>(m.outcome?.result ?? null);
  const [views, setViews] = useState(m.outcome?.views ? String(m.outcome.views) : "");
  const [editing, setEditing] = useState(!m.outcome);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = VERDICT_META[m.topic.call];

  const save = async () => {
    if (!result) return;
    setBusy(true); setError(null);
    const n = Number(views.replace(/[, ]/g, ""));
    try { await post({ action: "outcome", id: m.id, result, views: views && Number.isFinite(n) ? n : undefined }); setEditing(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-faint">
            {nicheLabel(m.topic.niche)} · made {relativeTime(m.madeAt)}{m.format && <> · {m.format}</>}
            <Badge tone={v.tone}>DeepField said: {v.label}</Badge>
          </p>
          <p className="mt-1 font-medium leading-snug">{m.topic.title}</p>
          {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-accent hover:underline">Your post<ExternalLink className="h-3 w-3" /></a>}
        </div>
        <button onClick={() => { if (confirm("Stop tracking this one?")) post({ action: "unmake", id: m.id }); }}
          aria-label="Stop tracking" className="rounded-md p-1 text-faint hover:text-ink"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>

      {m.outcome && !editing ? (
        <p className="mt-2 text-sm">
          <span className={cn("font-medium", RESULT_TONE[m.outcome.result])}>{OUTCOMES.find((o) => o.value === m.outcome!.result)?.label}</span>
          {m.outcome.views ? <span className="text-muted"> · {compact(m.outcome.views)} views</span> : null}
          <button onClick={() => setEditing(true)} className="ml-2 text-xs text-faint hover:text-ink hover:underline">Change</button>
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-muted">Compared with your usual posts, how did it do?</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {OUTCOMES.map((o) => (
              <button key={o.value} type="button" onClick={() => setResult(o.value)} aria-pressed={result === o.value} title={o.sub}
                className={cn("press rounded-xl px-2.5 py-2 text-left text-xs transition-colors", result === o.value ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink")}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input value={views} onChange={(e) => setViews(e.target.value)} placeholder="Views (optional)" inputMode="numeric"
              className="h-8 w-40 rounded-lg bg-canvas px-3 text-xs outline-none ring-1 ring-hair/15 focus:ring-2 focus:ring-accent/50" />
            <Button size="sm" variant="primary" onClick={save} loading={busy} disabled={!result} className="ml-auto">Save</Button>
          </div>
          {error && <p className="mt-2 text-xs text-fall" role="alert">{error}</p>}
        </div>
      )}
    </Card>
  );
}

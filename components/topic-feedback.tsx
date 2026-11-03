"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clapperboard, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Made } from "@/lib/feedback-shared";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

interface State { vote: 1 | -1 | 0; made: Made | null; tally: { up: number; down: number; made: number } }

const FORMATS = ["Short / Reel", "Long-form video", "Carousel", "Post or thread", "Newsletter", "Podcast"];

/**
 * Under a verdict: "Is this call right?" with everyone's tally, and "I made
 * this", which later asks how it did. Both feed what DeepField learns
 * (lib/feedback.ts).
 */
export function TopicFeedback({ topicKey }: { topicKey: string }) {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [format, setFormat] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch(`/api/feedback?topic=${encodeURIComponent(topicKey)}`).then((r) => r.json())
      .then((j) => j.ok && setS({ vote: j.vote, made: j.made, tally: j.tally }))
      .catch(() => {});
  }, [topicKey]);

  const send = async (body: object) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: topicKey, ...body }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Couldn't save that.");
      setS({ vote: j.vote, made: j.made, tally: j.tally });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <div className="mt-3 h-8" />;
  const others = { up: s.tally.up - (s.vote === 1 ? 1 : 0), down: s.tally.down - (s.vote === -1 ? 1 : 0) };
  const voteBtn = (v: 1 | -1) => {
    const on = s.vote === v;
    const Icon = v === 1 ? ThumbsUp : ThumbsDown;
    return (
      <button type="button" disabled={busy} onClick={() => send({ action: "vote", vote: on ? 0 : v })} aria-pressed={on}
        aria-label={v === 1 ? "The call is right" : "The call is wrong"}
        className={cn("press flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
          on ? (v === 1 ? "bg-rise/15 text-rise" : "bg-fall/15 text-fall") : "bg-hair/[0.06] text-muted hover:text-ink")}>
        <Icon className="h-3.5 w-3.5" />{v === 1 ? "Right" : "Wrong"}
      </button>
    );
  };

  return (
    <div className="mt-3 border-t border-hair/10 pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-muted">Is this call right?</span>
        <div className="flex gap-1.5">{voteBtn(1)}{voteBtn(-1)}</div>
        {(others.up > 0 || others.down > 0) && (
          <span className="text-[0.6875rem] text-faint">
            {others.up > 0 && `${others.up} ${others.up === 1 ? "creator agrees" : "creators agree"}`}
            {others.up > 0 && others.down > 0 && " · "}
            {others.down > 0 && `${others.down} ${others.down === 1 ? "disagrees" : "disagree"}`}
          </span>
        )}
        <span className="ml-auto">
          {s.made ? (
            <Link href="/made" className="flex items-center gap-1 text-xs font-medium text-rise hover:underline">
              <Check className="h-3.5 w-3.5" />You made this{s.made.outcome ? "" : " · tell us how it did"}
            </Link>
          ) : !making && (
            <Button size="sm" variant="ghost" onClick={() => setMaking(true)}><Clapperboard className="h-3.5 w-3.5" />I made this</Button>
          )}
        </span>
      </div>

      {making && !s.made && (
        <form className="mt-3 rounded-xl bg-hair/[0.04] p-3"
          onSubmit={async (e) => { e.preventDefault(); if (await send({ action: "made", format, url })) setMaking(false); }}>
          <p className="text-xs font-medium">What did you make? <span className="font-normal text-faint">Optional</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button key={f} type="button" onClick={() => setFormat(format === f ? null : f)} aria-pressed={format === f}
                className={cn("rounded-pill px-2.5 py-1 text-xs transition-colors", format === f ? "bg-ink text-canvas" : "bg-hair/[0.06] text-muted hover:text-ink")}>
                {f}
              </button>
            ))}
          </div>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link to it (optional)" inputMode="url"
            className="mt-2 h-9 w-full rounded-lg bg-canvas px-3 text-xs outline-none ring-1 ring-hair/15 focus:ring-2 focus:ring-accent/50" />
          <p className="mt-2 text-[0.6875rem] text-faint">In a few days, tell us how it did on <Link href="/made" className="underline">Track record</Link>. That&apos;s how DeepField learns which calls pay off.</p>
          <div className="mt-2 flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" type="button" onClick={() => setMaking(false)}>Cancel</Button>
            <Button size="sm" variant="primary" type="submit" loading={busy}>Save</Button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-fall" role="alert">{error}</p>}
    </div>
  );
}

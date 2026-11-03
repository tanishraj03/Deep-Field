"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import type { RegionCode } from "@/lib/niches";
import { cn, compact } from "@/lib/utils";
import { Button } from "./ui";

/**
 * Suggest a subreddit DeepField should read for a niche. It's checked on the
 * spot (exists, safe for work, active) and then waits for the admin; once
 * approved it is part of every scan of the niche.
 */
export function SuggestCommunity({ niche, label }: { niche: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState("");
  const [region, setRegion] = useState<RegionCode>("GLOBAL");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ sub: string; subscribers: number } | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ niche, sub, region, why }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Couldn't send that.");
      setSent(j.suggestion);
      setSub(""); setWhy("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setSent(null); }} className="mt-3 flex items-center gap-1 text-xs font-medium text-muted hover:text-accent">
        <Plus className="h-3.5 w-3.5" />Suggest a community for {label}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-hair/[0.04] p-3">
      {sent ? (
        <div className="text-xs">
          <p className="flex items-center gap-1.5 font-medium text-rise"><Check className="h-3.5 w-3.5" />Thanks, r/{sent.sub} is in the queue</p>
          <p className="mt-1 text-muted">It checks out ({compact(sent.subscribers)} members). Once it&apos;s approved, every {label} scan reads it.</p>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setSent(null)}>Suggest another</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (sub.trim()) submit(); }} className="space-y-2">
          <p className="text-xs font-medium">Which subreddit should DeepField read for {label}?</p>
          <div className="flex items-center gap-2">
            <span className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-faint">r/</span>
              <input value={sub} onChange={(e) => setSub(e.target.value.replace(/^\/?r\//i, ""))} autoFocus spellCheck={false}
                placeholder="IndiaInvestments" aria-label="Subreddit"
                className="h-9 w-full rounded-lg bg-canvas pl-7 pr-3 text-xs outline-none ring-1 ring-hair/15 focus:ring-2 focus:ring-accent/50" />
            </span>
            <div className="flex rounded-pill bg-hair/[0.06] p-0.5" role="radiogroup" aria-label="Region">
              {(["IN", "GLOBAL"] as RegionCode[]).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={region === r} onClick={() => setRegion(r)}
                  className={cn("rounded-pill px-2.5 py-1 text-xs", region === r ? "bg-surface text-ink shadow-sm" : "text-muted")}>
                  {r === "IN" ? "India" : "Global"}
                </button>
              ))}
            </div>
          </div>
          <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={280} placeholder="Why it matters (optional)"
            className="h-9 w-full rounded-lg bg-canvas px-3 text-xs outline-none ring-1 ring-hair/15 focus:ring-2 focus:ring-accent/50" />
          {error && <p className="text-xs text-fall" role="alert">{error}</p>}
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" type="submit" loading={busy} disabled={!sub.trim()}>{busy ? "Checking" : "Suggest"}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

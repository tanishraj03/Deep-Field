"use client";

import { useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { nicheLabel } from "@/lib/niches";
import type { Suggestion } from "@/lib/suggestions";
import { cn, compact, relativeTime } from "@/lib/utils";
import { Badge, Button, Card } from "./ui";

/** Communities people suggested: approve to add one to its niche's scans, reject to leave it out. */
export function SuggestionQueue({ initial }: { initial: Suggestion[] }) {
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = (s: Suggestion) => `${s.niche}:${s.sub}`;

  const decide = async (s: Suggestion, status: "approved" | "rejected") => {
    setBusy(id(s)); setError(null);
    try {
      const res = await fetch("/api/admin/suggestions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ niche: s.niche, sub: s.sub, status }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Couldn't save that.");
      setList((l) => l.map((x) => (id(x) === id(s) ? j.suggestion : x)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!list.length) return <Card className="px-4 py-10 text-center text-sm text-muted">No communities suggested yet. People can suggest one from any niche on Pulse.</Card>;
  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-fall" role="alert">{error}</p>}
      <Card className="divide-y">
        {list.map((s) => (
          <div key={id(s)} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between", s.status !== "pending" && "opacity-70")}>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <a href={`https://www.reddit.com/r/${s.sub}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium hover:text-accent">
                  r/{s.sub}<ExternalLink className="h-3 w-3" />
                </a>
                <Badge tone="outline">{nicheLabel(s.niche)} · {s.region === "IN" ? "India" : "Global"}</Badge>
                {s.status !== "pending" && <Badge tone={s.status === "approved" ? "rise" : "neutral"}>{s.status === "approved" ? "Approved" : "Rejected"}</Badge>}
              </p>
              <p className="num mt-1 text-xs text-muted">{compact(s.subscribers)} members · {s.postsWeek} posts this week · suggested by {s.by.username ? `@${s.by.username}` : "someone"} {relativeTime(s.at)}</p>
              {s.description && <p className="mt-1 line-clamp-2 text-xs text-faint">{s.description}</p>}
              {s.why && <p className="mt-1 text-xs text-ink/80">&ldquo;{s.why}&rdquo;</p>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {s.status !== "rejected" && <Button size="sm" variant="ghost" loading={busy === id(s)} onClick={() => decide(s, "rejected")}><X className="h-3.5 w-3.5" />{s.status === "approved" ? "Remove" : "Reject"}</Button>}
              {s.status !== "approved" && <Button size="sm" variant="primary" loading={busy === id(s)} onClick={() => decide(s, "approved")}><Check className="h-3.5 w-3.5" />Approve</Button>}
            </div>
          </div>
        ))}
      </Card>
      <p className="text-xs text-faint">Every suggestion was checked when it was made: it exists, isn&apos;t NSFW, has 1,000+ members and posts most days. Approved ones join the niche&apos;s next scan.</p>
    </div>
  );
}

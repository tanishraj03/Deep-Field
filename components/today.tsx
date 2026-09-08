"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronRight, Loader2, RefreshCw, X } from "lucide-react";
import { Capsule, Empty, Eyebrow, Glass, LiveDot, Tag, riseIn, stagger } from "./ui";
import { cn, istClock, istDate, relativeTime, truncate } from "@/lib/utils";
import type { IntelligenceItem, Snapshot } from "@/lib/types";

// ── Status line: small system indicators, not KPI cards ───────────────────────

function StatusLine({ snapshot }: { snapshot: Snapshot }) {
  const run = snapshot.lastRun;
  const stats = [
    { label: "Last refresh", value: run?.finishedAt ? istClock(new Date(run.finishedAt)) : "—" },
    { label: "Sources checked", value: run ? String(run.sourcesChecked) : "—" },
    { label: "New signals", value: String(snapshot.items.filter((i) => i.isNew).length) },
    { label: "Opportunities", value: String(snapshot.items.filter((i) => (i.opportunityScore ?? 0) >= 70).length) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {stats.map((s) => (
        <span key={s.label} className="readout inline-flex items-baseline gap-1.5 text-[0.75rem]">
          <span className="text-faint">{s.label}</span>
          <span className="font-semibold tabular-nums">{s.value}</span>
        </span>
      ))}
      {run && run.sourcesFailed > 0 && (
        <span className="readout inline-flex items-center gap-1.5 text-[0.75rem]" style={{ color: "rgb(var(--ember))" }}>
          <LiveDot ok={false} />
          {run.sourcesFailed} sources unavailable
        </span>
      )}
      <RefreshButton />
    </div>
  );
}

/**
 * Collect again, now. Reports what came back rather than just spinning —
 * including a refusal, so a throttled or failed refresh is visible instead of
 * looking like a page that quietly did nothing.
 */
function RefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [note, setNote] = useState("");

  async function refresh() {
    setState("busy"); setNote("");
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setState("idle");
        setNote(`${json.sourcesChecked - json.sourcesFailed}/${json.sourcesChecked} sources`);
        router.refresh();
        setTimeout(() => setNote(""), 6000);
      } else {
        setState("error");
        setNote(json.reason ?? `Failed with status ${res.status}`);
        setTimeout(() => { setState("idle"); setNote(""); }, 8000);
      }
    } catch (err) {
      setState("error");
      setNote(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={refresh}
        disabled={state === "busy"}
        aria-label="Collect from all sources again now"
        className={cn(
          "press readout inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.7rem] font-semibold",
          "text-faint transition-colors hover:text-ink disabled:opacity-60",
        )}
        style={{ background: "rgb(var(--hair) / 0.05)" }}
      >
        {state === "busy"
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <RefreshCw className="h-3 w-3" />}
        {state === "busy" ? "Collecting" : "Refresh"}
      </button>
      {note && (
        <span
          className="readout text-[0.7rem]"
          style={{ color: state === "error" ? "rgb(var(--ember))" : "rgb(var(--muted))" }}
        >
          {note}
        </span>
      )}
    </span>
  );
}

// ── THE SIGNAL ────────────────────────────────────────────────────────────────

function TheSignal({ snapshot }: { snapshot: Snapshot }) {
  const [open, setOpen] = useState(false);
  const signal = snapshot.brief?.theSignal;

  if (!signal?.headline) {
    return (
      <Empty
        title="No signal yet this morning."
        action="Run a collection from Settings → System, or wait for the 6:00 AM schedule."
      />
    );
  }

  return (
    <Glass className="relative overflow-hidden p-6 sm:p-9">
      {/* One soft light source, top-left, so the panel reads as a physical surface. */}
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "rgb(var(--accent) / 0.12)" }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <LiveDot />
          <Eyebrow>The Signal</Eyebrow>
          <Tag tone="outline" className="ml-auto">
            {signal.generatedBy === "gemini" ? "AI interpretation" : "Rules only"}
          </Tag>
        </div>

        <p className="mt-4 text-[1.375rem] font-medium leading-[1.34] tracking-[-0.022em] sm:text-[1.75rem] sm:leading-[1.28]">
          {signal.headline}
        </p>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="press mt-5 inline-flex items-center gap-1 text-[0.875rem] font-medium text-muted transition-colors hover:text-ink"
        >
          Why this matters
          <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-90")} />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden"
            >
              <p className="hairline mt-4 pt-4 text-[0.9375rem] leading-[1.65] text-ink/80">
                {signal.reasoning}
              </p>
              <p className="readout mt-3 text-[0.7rem] text-faint">
                Derived from {snapshot.items.length} deduplicated items across{" "}
                {new Set(snapshot.items.flatMap((i) => i.sources.map((s) => s.name))).size} sources.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Glass>
  );
}

// ── Control Centre tiles ──────────────────────────────────────────────────────

interface TileSpec {
  id: string;
  label: string;
  href: string;
  items: IntelligenceItem[];
  metric: (i: IntelligenceItem) => number | undefined;
  span?: string;
}

function TileBody({ spec }: { spec: TileSpec }) {
  const top = spec.items[0];
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>{spec.label}</Eyebrow>
        <span className="readout text-[0.75rem] font-semibold tabular-nums text-faint">
          {spec.items.length}
        </span>
      </div>
      {top ? (
        <>
          <p className="mt-3 text-[0.9375rem] font-medium leading-snug tracking-[-0.011em]">
            {truncate(top.funding?.companyName ?? top.marketing?.companyName ?? top.title, 78)}
          </p>
          <p className="readout mt-1.5 text-[0.7rem] text-faint">
            {top.sources[0]?.name ?? "source"} · {relativeTime(top.publishedAt)}
          </p>
          {typeof spec.metric(top) === "number" && (
            <div className="mt-4">
              <Capsule
                value={spec.metric(top) as number}
                tone={top.trendLabel === "BREAKOUT" ? "ember" : "accent"}
                threshold={85}
              />
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-[0.875rem] text-faint">Nothing new here today.</p>
      )}
    </>
  );
}

function ExpandedTile({ spec, onClose }: { spec: TileSpec; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.button
        className="absolute inset-0 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      />
      <motion.div
        layoutId={`tile-${spec.id}`}
        className="glass glass-lit relative w-full max-w-2xl rounded-module p-6 sm:p-7"
        style={{ maxHeight: "82dvh", overflowY: "auto" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
      >
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{spec.label}</Eyebrow>
          <button onClick={onClose} className="press rounded-pill p-1.5 text-faint hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {spec.items.slice(0, 5).map((i) => (
            <li key={i.id} className="hairline pt-3 first:border-0 first:pt-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-medium leading-snug">
                    {truncate(i.funding?.companyName ?? i.marketing?.companyName ?? i.title, 90)}
                  </p>
                  <p className="mt-1 text-[0.8125rem] leading-snug text-muted">
                    {truncate(i.analysis?.whyWeCare || i.analysis?.whyItsMoving || i.summary, 150)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Tag tone={i.trendLabel === "BREAKOUT" ? "ember" : "neutral"}>{i.signalLabel}</Tag>
                    <span className="readout text-[0.7rem] text-faint">
                      {i.sources.length} source{i.sources.length === 1 ? "" : "s"} · {relativeTime(i.publishedAt)}
                    </span>
                  </div>
                </div>
                {typeof spec.metric(i) === "number" && (
                  <span className="readout shrink-0 text-[1.125rem] font-semibold tabular-nums">
                    {spec.metric(i)}
                  </span>
                )}
              </div>
            </li>
          ))}
          {!spec.items.length && <li className="text-[0.875rem] text-faint">Nothing new here today.</li>}
        </ul>

        <Link
          href={spec.href}
          className="press mt-6 inline-flex items-center gap-1.5 rounded-pill bg-[rgb(var(--hair)/0.07)] px-4 py-2 text-[0.8125rem] font-semibold transition-colors hover:text-ink"
        >
          Open {spec.label} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>
    </motion.div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function Today({ snapshot }: { snapshot: Snapshot }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const specs = useMemo<TileSpec[]>(() => {
    const byTrend = (a: IntelligenceItem, b: IntelligenceItem) => (b.trendScore ?? 0) - (a.trendScore ?? 0);
    const byOpp = (a: IntelligenceItem, b: IntelligenceItem) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
    const items = snapshot.items;

    return [
      {
        id: "moving", label: "What's Moving", href: "/signals",
        items: items.filter((i) => i.type === "trend").sort(byTrend),
        metric: (i) => i.trendScore,
      },
      {
        id: "money", label: "Money Moves", href: "/money",
        items: items.filter((i) => i.type === "funding").sort(byOpp),
        metric: (i) => i.opportunityScore,
      },
      {
        id: "spend", label: "Who's Spending", href: "/spend",
        items: items.filter((i) => i.type === "marketing").sort(byOpp),
        metric: (i) => i.opportunityScore,
      },
      {
        id: "talk", label: "Who We Should Talk To", href: "/opportunities",
        items: items.filter((i) => typeof i.opportunityScore === "number").sort(byOpp),
        metric: (i) => i.opportunityScore,
      },
      {
        id: "watch", label: "Watch", href: "/signals",
        items: items.filter((i) => i.signalLabel === "EARLY SIGNAL" || i.confidenceLabel === "Low"),
        metric: (i) => i.trendScore,
      },
    ];
  }, [snapshot.items]);

  const active = specs.find((s) => s.id === expanded) ?? null;

  return (
    <div className="space-y-7">
      <header className="pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-[2.25rem] font-semibold tracking-[-0.035em] sm:text-[2.75rem]">Today</h1>
          {snapshot.mode === "mock" && <Tag tone="ember" className="mb-1 self-end">Mock data</Tag>}
        </div>
        <p className="readout mt-1 text-[0.8125rem] text-muted">{istDate()}</p>
        <div className="mt-4">
          <StatusLine snapshot={snapshot} />
        </div>
      </header>

      <TheSignal snapshot={snapshot} />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {specs.map((spec) => (
          <motion.button
            key={spec.id}
            variants={riseIn}
            layoutId={`tile-${spec.id}`}
            onClick={() => setExpanded(spec.id)}
            className={cn(
              "glass glass-lit press rounded-module p-5 text-left",
              spec.id === "talk" && "sm:col-span-2 lg:col-span-1",
            )}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <TileBody spec={spec} />
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence>
        {active && <ExpandedTile spec={active} onClose={() => setExpanded(null)} />}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/brief"
          className="press glass glass-lit inline-flex items-center gap-2 rounded-pill px-5 py-2.5 text-[0.875rem] font-semibold"
        >
          Read the daily brief <ArrowRight className="h-4 w-4" />
        </Link>
        <span className="readout text-[0.7rem] text-faint">
          {snapshot.brief ? `Written ${relativeTime(snapshot.brief.generatedAt)}` : "Not generated yet"}
        </span>
      </div>
    </div>
  );
}

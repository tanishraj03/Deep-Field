"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, RefreshCw, X } from "lucide-react";
import { NICHES, nicheLabel } from "@/lib/niches";
import { Button } from "./ui";

export interface ScanProgress {
  running: boolean;
  done: number;
  total: number;
  current: string | null;
  log: { label: string; ok: boolean; detail: string }[];
  /** The server stopped hearing from the job: pressing scan again resumes it. */
  stalled?: boolean;
}

const idle: ScanProgress = { running: false, done: 0, total: 0, current: null, log: [] };

interface JobView {
  status: "running" | "done";
  stalled: boolean;
  updatedAt: string;
  items: { id: string; label: string }[];
  results: { id: string; label: string; ok: boolean; detail: string }[];
}

/** A finished scan keeps showing its summary this long, then the panel goes away by itself. */
const SHOW_FINISHED_MS = 3 * 60_000;

function toProgress(j: JobView | null): ScanProgress {
  if (!j) return idle;
  const running = j.status === "running" && !j.stalled;
  if (!running && !j.stalled && Date.now() - Date.parse(j.updatedAt) > SHOW_FINISHED_MS) return idle;
  return {
    running,
    stalled: j.stalled,
    done: j.results.length,
    total: j.items.length,
    current: j.items[j.results.length]?.label ?? null,
    log: j.results.map((r) => ({ label: r.label, ok: r.ok, detail: r.detail })),
  };
}

/*
  One watcher per tab, shared by every scan button on the page. Scans run on
  the server (lib/scan-jobs.ts), so this only reads the job: it keeps
  polling while one is running, picks it up again after you come back, and
  stops when it's done.
*/
let state: ScanProgress = idle;
const listeners = new Set<(p: ScanProgress) => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let onProgress: ((before: number, after: number) => void) | null = null;

function publish(next: ScanProgress) {
  const before = state.done;
  state = next;
  listeners.forEach((l) => l(next));
  if (next.done > before) onProgress?.(before, next.done);
}

async function poll() {
  timer = null;
  try {
    const res = await fetch("/api/scan/run", { cache: "no-store" });
    const j = await res.json();
    if (j.ok) publish(toProgress(j.job));
  } catch {
    // Offline for a moment; try again on the next tick.
  }
  if (state.running && listeners.size && !timer) timer = setTimeout(poll, document.hidden ? 15_000 : 3_000);
}

export function useScanRunner() {
  const router = useRouter();
  const [p, setP] = useState<ScanProgress>(state);

  useEffect(() => {
    listeners.add(setP);
    // New results mean new scans: refresh the page so they show.
    onProgress = () => router.refresh();
    if (listeners.size === 1 && !timer) poll();
    return () => { listeners.delete(setP); };
  }, [router]);

  const run = useCallback(async (nicheIds: string[], opts: { signals?: boolean } = {}) => {
    publish({ ...idle, running: true, total: nicheIds.length + (opts.signals ? 1 : 0), current: "starting" });
    try {
      const res = await fetch("/api/scan/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niches: nicheIds, signals: !!opts.signals }),
      });
      const j = await res.json();
      if (!j.ok) {
        publish({ ...idle, total: 1, log: [{ label: j.needsKey ? "Add an AI key in Keys" : "Couldn't start the scan", ok: false, detail: j.needsKey ? "needed to scan" : j.error ?? `HTTP ${res.status}` }], done: 1 });
        return;
      }
      publish(toProgress(j.job));
      if (!timer) timer = setTimeout(poll, 3_000);
    } catch (e) {
      publish({ ...idle, total: 1, done: 1, log: [{ label: "Couldn't start the scan", ok: false, detail: (e as Error).message }] });
    }
  }, []);

  return { progress: p, run, reset: () => publish(idle) };
}

export function ScanAllButton({ stale, size = "md", label = "Scan everything" }: { stale?: string[]; size?: "sm" | "md"; label?: string }) {
  const { progress, run } = useScanRunner();
  const ids = stale?.length ? stale : NICHES.map((n) => n.id);
  return (
    <div className="relative">
      <Button size={size} variant="secondary" loading={progress.running} onClick={() => run(ids, { signals: true })}>
        {!progress.running && <RefreshCw className="h-3.5 w-3.5" />}
        {progress.running ? `Scanning ${Math.min(progress.done + 1, progress.total)}/${progress.total}` : progress.stalled ? "Resume scan" : label}
      </Button>
      {/* Floats over the page so a running scan never pushes the layout down. */}
      <div className="absolute right-0 top-full z-40 mt-2">
        <ScanProgressPanel progress={progress} />
      </div>
    </div>
  );
}

export function ScanProgressPanel({ progress }: { progress: ScanProgress }) {
  return (
    <AnimatePresence>
      {(progress.running || progress.log.length > 0) && progress.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="card w-72 p-3 text-xs shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">{progress.running ? `Scanning ${progress.current}…` : progress.stalled ? "Scan paused" : "Scan finished"}</span>
            <span className="num text-muted">{progress.done}/{progress.total}</span>
          </div>
          <div className="mb-2 h-1 overflow-hidden rounded-pill bg-hair/10">
            <motion.div className="h-full bg-accent" animate={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {progress.running && <p className="mb-2 text-[0.6875rem] text-faint">Runs on the server: you can leave this page or close the tab.</p>}
          {progress.stalled && <p className="mb-2 text-[0.6875rem] text-faint">It stopped partway. Press the scan button to carry on from here.</p>}
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {progress.log.slice().reverse().map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                {l.ok ? <Check className="h-3 w-3 text-rise" /> : <X className="h-3 w-3 text-fall" />}
                <span className="truncate">{l.label}</span>
                <span className="ml-auto shrink-0 text-faint">{l.detail}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

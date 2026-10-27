"use client";

import { useCallback, useState } from "react";
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
}

const idle: ScanProgress = { running: false, done: 0, total: 0, current: null, log: [] };

/**
 * Scans run one niche per request — each fits inside a serverless time limit,
 * the whole catalogue does not — so the browser walks the list and shows
 * progress as it goes. The page refreshes after each niche, so results
 * appear while the rest are still scanning.
 */
export function useScanRunner() {
  const router = useRouter();
  const [p, setP] = useState<ScanProgress>(idle);

  const run = useCallback(async (nicheIds: string[], opts: { signals?: boolean; force?: boolean } = {}) => {
    const jobs = [
      ...(opts.signals ? [{ id: "signals", label: "Spiking searches & pages", url: "/api/scan?signals=1" }] : []),
      ...nicheIds.map((id) => ({ id, label: nicheLabel(id), url: `/api/scan?niche=${id}` })),
    ];
    setP({ running: true, done: 0, total: jobs.length, current: jobs[0]?.label ?? null, log: [] });
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      setP((s) => ({ ...s, current: job.label }));
      let entry: ScanProgress["log"][number];
      try {
        const res = await fetch(job.url, { method: "POST" });
        const json = await res.json();
        entry = json.ok
          ? { label: job.label, ok: true, detail: json.skipped ? "already fresh" : json.topics !== undefined ? `${json.topics} topics` : `${json.signals} signals` }
          : { label: job.label, ok: false, detail: json.error ?? `HTTP ${res.status}` };
      } catch (e) {
        entry = { label: job.label, ok: false, detail: (e as Error).message };
      }
      setP((s) => ({ ...s, done: i + 1, log: [...s.log, entry] }));
      router.refresh();
    }
    setP((s) => ({ ...s, running: false, current: null }));
  }, [router]);

  return { progress: p, run, reset: () => setP(idle) };
}

export function ScanAllButton({ stale, size = "md", label = "Scan everything" }: { stale?: string[]; size?: "sm" | "md"; label?: string }) {
  const { progress, run } = useScanRunner();
  const ids = stale?.length ? stale : NICHES.map((n) => n.id);
  return (
    <div className="relative">
      <Button size={size} variant="secondary" loading={progress.running} onClick={() => run(ids, { signals: true })}>
        {!progress.running && <RefreshCw className="h-3.5 w-3.5" />}
        {progress.running ? `Scanning ${progress.done + 1}/${progress.total}` : label}
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
            <span className="font-semibold">{progress.running ? `Scanning ${progress.current}…` : "Scan finished"}</span>
            <span className="num text-muted">{progress.done}/{progress.total}</span>
          </div>
          <div className="mb-2 h-1 overflow-hidden rounded-pill bg-hair/10">
            <motion.div className="h-full bg-accent" animate={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
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

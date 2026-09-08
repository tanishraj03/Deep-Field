"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { AutoCard, OpportunityCard } from "./cards";
import { Filters } from "./filters";
import { Empty, Eyebrow, stagger } from "./ui";
import { useSaved } from "./saved";
import { applyFilters, defaultFilters, type FilterState } from "@/lib/filters";
import { applyPrefs, describePrefs, isEmptyFeed, loadPrefs, type Prefs } from "@/lib/prefs";
import type { IntelligenceItem, Snapshot } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

export function SectionView({
  snapshot, title, kicker, type, variant = "auto", defaultWindow = 1, showStrength = false,
}: {
  snapshot: Snapshot;
  title: string;
  kicker: string;
  type?: IntelligenceItem["type"];
  variant?: "auto" | "opportunity";
  defaultWindow?: number;
  showStrength?: boolean;
}) {
  const [filters, setFilters] = useState<FilterState>({ ...defaultFilters, windowDays: defaultWindow });
  const { toggle, isSaved } = useSaved();

  // The feed built during setup, applied ahead of the on-screen filters.
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [bypass, setBypass] = useState(false);
  useEffect(() => setPrefs(loadPrefs()), []);

  const typed = useMemo(
    () => (type ? snapshot.items.filter((i) => i.type === type) : snapshot.items),
    [snapshot.items, type],
  );

  const feedActive = Boolean(prefs && !isEmptyFeed(prefs) && !bypass);
  const pool = useMemo(
    () => (feedActive && prefs ? applyPrefs(typed, prefs) : typed),
    [typed, prefs, feedActive],
  );
  const hiddenByFeed = typed.length - pool.length;

  const visible = useMemo(() => {
    const filtered = applyFilters(pool, filters);
    return variant === "opportunity"
      ? filtered.filter((i) => typeof i.opportunityScore === "number")
          .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
      : filtered.sort((a, b) =>
          (b.novelty * 60 + (b.trendScore ?? b.opportunityScore ?? 0) * 0.4) -
          (a.novelty * 60 + (a.trendScore ?? a.opportunityScore ?? 0) * 0.4));
  }, [pool, filters, variant]);

  const olderCount = pool.length - visible.length;

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>{kicker}</Eyebrow>
        <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">{title}</h1>
        <p className="readout mt-2 text-[0.75rem] text-faint">
          {visible.length} shown · last checked {relativeTime(snapshot.lastRun?.finishedAt ?? snapshot.generatedAt)}
          {snapshot.lastRun && snapshot.lastRun.sourcesFailed > 0 &&
            ` · ${snapshot.lastRun.sourcesFailed} sources unavailable`}
        </p>
      </header>

      <Filters value={filters} onChange={setFilters} showStrength={showStrength} />

      {/*
        A filter nobody can see is indistinguishable from missing data, so the
        feed always announces itself and always offers the way out.
      */}
      {prefs && !isEmptyFeed(prefs) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.9} />
          <span className="readout text-[0.7rem] uppercase tracking-[0.09em] text-faint">
            {bypass
              ? "Your feed is off — showing everything"
              : `Your feed · ${describePrefs(prefs)}`}
            {feedActive && hiddenByFeed > 0 && ` · ${hiddenByFeed} hidden`}
          </span>
          <button
            onClick={() => setBypass((b) => !b)}
            className="press text-[0.75rem] font-medium text-muted underline decoration-[rgb(var(--hair)/0.3)] underline-offset-[3px] transition-colors hover:text-ink"
          >
            {bypass ? "Use my feed" : "Show everything"}
          </button>
          <Link
            href="/welcome"
            className="press text-[0.75rem] font-medium text-faint transition-colors hover:text-ink"
          >
            Edit
          </Link>
        </div>
      )}

      {visible.length === 0 ? (
        <Empty
          title="Nothing in this window."
          action={
            feedActive && hiddenByFeed > 0
              ? `${hiddenByFeed} item${hiddenByFeed === 1 ? "" : "s"} were collected but sit outside the feed you built. Use "Show everything" above, or edit your feed.`
              : olderCount > 0
                ? `${olderCount} older item${olderCount === 1 ? "" : "s"} sit outside the current filters. Widen the window or clear the search.`
                : "Run a collection from Settings → System, or widen the filters."
          }
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {visible.map((item) =>
            variant === "opportunity" ? (
              <OpportunityCard key={item.id} item={item} saved={isSaved(item.id)} onToggle={toggle} />
            ) : (
              <AutoCard key={item.id} item={item} saved={isSaved(item.id)} onToggle={toggle} />
            ),
          )}
        </motion.div>
      )}

      <p className="readout pb-2 text-center text-[0.7rem] text-faint">
        Free-tier limits apply. Coverage reduces rather than stopping when a quota runs out.
      </p>
    </div>
  );
}

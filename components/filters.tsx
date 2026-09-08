"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterState } from "@/lib/filters";

const PLATFORMS = ["All", "instagram", "youtube", "x", "linkedin", "reddit", "tiktok", "threads", "google-trends", "web"];
const PLATFORM_LABEL: Record<string, string> = {
  All: "All platforms", instagram: "Instagram", youtube: "YouTube", x: "X", linkedin: "LinkedIn",
  reddit: "Reddit", tiktok: "TikTok", threads: "Threads", "google-trends": "Google Trends", web: "Web",
};
const CATEGORIES = ["All", "Culture", "Entertainment", "Music", "Fashion", "Food", "Gaming", "AI",
  "Technology", "Finance", "Beauty", "Fitness", "Education", "Travel", "Consumer", "Creator Economy"];
const STRENGTH = ["All", "BREAKOUT", "RISING", "WATCH", "LOW SIGNAL"];
const WINDOWS = [
  { label: "24 hours", value: 1 }, { label: "3 days", value: 3 },
  { label: "7 days", value: 7 }, { label: "30 days", value: 30 },
];

function Segmented({ options, value, onChange }: {
  options: { label: string; value: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="glass glass-lit inline-flex rounded-pill p-0.5" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "press relative rounded-pill px-3.5 py-1.5 text-[0.75rem] font-semibold tracking-[0.02em] transition-colors",
              active ? "text-ink" : "text-faint hover:text-muted",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join("")}`}
                className="absolute inset-0 rounded-pill"
                style={{ background: "rgb(var(--hair) / 0.08)" }}
                transition={{ type: "spring", stiffness: 440, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Select({ label, value, options, format, onChange }: {
  label: string; value: string; options: string[];
  format?: (v: string) => string; onChange: (v: string) => void;
}) {
  return (
    <label className="glass inline-flex items-center gap-2 rounded-pill py-1.5 pl-3 pr-2">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-[0.75rem] font-semibold text-ink focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-canvas text-ink">
            {format ? format(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Filters({ value, onChange, showStrength = false }: {
  value: FilterState; onChange: (f: FilterState) => void; showStrength?: boolean;
}) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={[
            { label: "India", value: "INDIA" },
            { label: "Global", value: "GLOBAL" },
            { label: "All", value: "ALL" },
          ]}
          value={value.scope}
          onChange={(v) => set({ scope: v as FilterState["scope"] })}
        />
        <Segmented
          options={WINDOWS.map((w) => ({ label: w.label, value: String(w.value) }))}
          value={String(value.windowDays)}
          onChange={(v) => set({ windowDays: Number(v) })}
        />
      </div>

      <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        <label className="glass inline-flex min-w-[12rem] flex-1 items-center gap-2 rounded-pill px-3 py-1.5 lg:max-w-xs">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={2} />
          <input
            value={value.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search trends, companies, investors"
            className="w-full bg-transparent text-[0.8125rem] placeholder:text-faint focus:outline-none"
          />
        </label>
        <Select label="Platform" value={value.platform} options={PLATFORMS}
                format={(v) => PLATFORM_LABEL[v] ?? v} onChange={(v) => set({ platform: v })} />
        <Select label="Industry" value={value.category} options={CATEGORIES}
                onChange={(v) => set({ category: v })} />
        {showStrength && (
          <Select label="Strength" value={value.strength} options={STRENGTH}
                  onChange={(v) => set({ strength: v })} />
        )}
      </div>
    </div>
  );
}

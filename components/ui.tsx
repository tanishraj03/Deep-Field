"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Loader2, Sparkles, Zap } from "lucide-react";
import type { RegionFilter, SourceId, TopicVerdict } from "@/lib/types";
import { cn, compact } from "@/lib/utils";

export function Card({ className, children, hover, ...rest }: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn("card", hover && "card-hover", className)} {...rest}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

export function Badge({
  children, tone = "neutral", className,
}: { children: React.ReactNode; tone?: "neutral" | "accent" | "ember" | "rise" | "fall" | "outline"; className?: string }) {
  const tones = {
    neutral: "bg-hair/[0.06] text-muted",
    accent: "bg-accent/10 text-accent",
    ember: "bg-ember/10 text-ember",
    rise: "bg-rise/10 text-rise",
    fall: "bg-fall/10 text-fall",
    outline: "border border-hair/15 text-muted",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-0.5 text-[0.6875rem] font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Segmented control. Used for region everywhere so it reads as one instrument. */
export function Segmented<T extends string>({
  value, onChange, options, layoutId, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  layoutId: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center rounded-pill bg-hair/[0.06] p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-pill font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-[0.8125rem]",
            value === o.value ? "text-ink" : "text-muted hover:text-ink",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-pill bg-surface shadow-sm ring-1 ring-hair/10"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export const REGION_OPTIONS: { value: RegionFilter; label: React.ReactNode }[] = [
  { value: "ALL", label: "Everywhere" },
  { value: "IN", label: <><Flag region="IN" /> India</> },
  { value: "GLOBAL", label: <><Flag region="GLOBAL" /> Global</> },
];

export function Flag({ region }: { region: "IN" | "GLOBAL" }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: region === "IN" ? "rgb(var(--india))" : "rgb(var(--global))" }}
    />
  );
}

export function Button({
  children, variant = "secondary", size = "md", loading, className, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md"; loading?: boolean;
}) {
  const variants = {
    primary: "bg-ink text-canvas hover:opacity-90",
    secondary: "bg-surface text-ink ring-1 ring-hair/10 hover:ring-hair/20",
    ghost: "text-muted hover:text-ink hover:bg-hair/[0.05]",
  };
  return (
    <button
      className={cn(
        "press inline-flex items-center justify-center gap-1.5 rounded-pill font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-[0.8125rem]",
        variants[variant], className,
      )}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p className="num mt-1 text-[1.625rem] font-semibold leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Heat, 0–100, as a number plus a short bar. Ember marks the hot end only. */
export function Heat({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  const hot = value >= 70;
  const dims = { sm: "text-sm", md: "text-base", lg: "text-[2rem]" }[size];
  return (
    <div className="flex flex-col items-end" aria-label={`Heat ${value} out of 100`}>
      <span className={cn("num font-semibold leading-none", dims, hot ? "text-ember" : "text-ink")}>{value}</span>
      {/* In dense lists the coloured number carries it; the bar is for cards. */}
      {size !== "sm" && (
        <span className={cn("mt-1 overflow-hidden rounded-pill bg-hair/10", size === "lg" ? "h-1.5 w-20" : "h-1 w-8")}>
          <span
            className="block h-full rounded-pill"
            style={{ width: `${value}%`, background: hot ? "rgb(var(--ember))" : "rgb(var(--ink) / 0.55)" }}
          />
        </span>
      )}
    </div>
  );
}

export function Delta({ isNew, delta }: { isNew: boolean; delta: number | null }) {
  if (isNew) return <Badge tone="accent"><Sparkles className="h-3 w-3" />New</Badge>;
  if (delta === null || Math.abs(delta) < 3) return null;
  return delta > 0
    ? <Badge tone="rise"><ArrowUpRight className="h-3 w-3" />+{delta}</Badge>
    : <Badge tone="fall"><ArrowDownRight className="h-3 w-3" />{delta}</Badge>;
}

/** India vs Global share of a conversation. Two series, so both are labelled. */
export function RegionSplit({ IN, GLOBAL, compactLabel }: { IN: number; GLOBAL: number; compactLabel?: boolean }) {
  const total = IN + GLOBAL;
  if (!total) return null;
  const pIN = Math.round((IN / total) * 100);
  if (compactLabel) {
    // One line: "India only", "Global only", or the India share with a hairline bar.
    const only = pIN === 100 ? "IN" : pIN === 0 ? "GLOBAL" : null;
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-muted" title={`India ${pIN}% · Global ${100 - pIN}%`}>
        {only ? (
          <><Flag region={only} />{only === "IN" ? "India only" : "Global only"}</>
        ) : (
          <>
            <span className="flex h-1 w-10 gap-px overflow-hidden rounded-pill">
              <span className="h-full" style={{ width: `${pIN}%`, background: "rgb(var(--india))" }} />
              <span className="h-full flex-1" style={{ background: "rgb(var(--global))" }} />
            </span>
            <span className="num">{pIN}% India</span>
          </>
        )}
      </span>
    );
  }
  return (
    <div className="min-w-0">
      <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-pill">
        {IN > 0 && <span className="h-full rounded-pill" style={{ width: `${pIN}%`, background: "rgb(var(--india))" }} />}
        {GLOBAL > 0 && <span className="h-full flex-1 rounded-pill" style={{ background: "rgb(var(--global))" }} />}
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] text-muted">
        <span className="flex items-center gap-1"><Flag region="IN" />India {pIN}%</span>
        <span className="flex items-center gap-1">Global {100 - pIN}%<Flag region="GLOBAL" /></span>
      </div>
    </div>
  );
}

export const SOURCE_META: Record<SourceId, { label: string; short: string; color: string }> = {
  reddit: { label: "Reddit", short: "Reddit", color: "#FF4500" },
  hackernews: { label: "Hacker News", short: "HN", color: "#FF6600" },
  youtube: { label: "YouTube", short: "YouTube", color: "#FF0033" },
  news: { label: "News", short: "News", color: "#8A8D96" },
  wikipedia: { label: "Wikipedia", short: "Wiki", color: "#8A8D96" },
  "google-trends": { label: "Google Trends", short: "Trends", color: "#4285F4" },
  bluesky: { label: "Bluesky", short: "Bluesky", color: "#1185FE" },
  mastodon: { label: "Mastodon", short: "Mastodon", color: "#6364FF" },
  x: { label: "X", short: "X", color: "#71767B" },
  lemmy: { label: "Lemmy", short: "Lemmy", color: "#00BC8C" },
  instagram: { label: "Instagram", short: "Insta", color: "#E1306C" },
};

/** Source names are always written out; the dot is decoration, never the only cue. */
export function SourceTag({ source, count }: { source: SourceId; count?: number }) {
  const m = SOURCE_META[source];
  return (
    <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden />
      {m.short}{count !== undefined && <span className="num text-faint">{count}</span>}
    </span>
  );
}

export function Metric({ icon: Icon, value, label }: { icon: React.ElementType; value: number | undefined; label: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={`${value.toLocaleString("en-US")} ${label}`}>
      <Icon className="h-3.5 w-3.5 text-faint" strokeWidth={2} />
      <span className="num font-medium text-ink/80">{compact(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: React.ElementType; title: string; body: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-hair/[0.06]">
        <Icon className="h-5 w-5 text-muted" />
      </span>
      <p className="mt-4 text-[0.95rem] font-semibold">{title}</p>
      <div className="mt-1.5 max-w-md text-sm text-muted">{body}</div>
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export const VERDICT_META: Record<TopicVerdict["call"], { label: string; tone: "rise" | "ember" | "neutral" }> = {
  make: { label: "Make now", tone: "rise" },
  test: { label: "Worth testing", tone: "ember" },
  skip: { label: "Skip", tone: "neutral" },
};

/** The content call, with its reasons on hover. */
export function VerdictBadge({ verdict }: { verdict?: TopicVerdict }) {
  if (!verdict) return null;
  const m = VERDICT_META[verdict.call];
  return (
    <span title={verdict.reasons.join(" · ")}>
      <Badge tone={m.tone}>{m.label}</Badge>
    </span>
  );
}

/** Virality as a compact chip: the number, and the pace behind it on hover. */
export function ViralityChip({ value, perHour }: { value: number | undefined; perHour?: number }) {
  if (value === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted"
      title={`Virality ${value}/100${perHour !== undefined ? ` · ~${compact(perHour)} reactions an hour` : ""}`}>
      <Zap className={cn("h-3.5 w-3.5", value >= 70 ? "text-ember" : "text-faint")} strokeWidth={2} />
      <span className={cn("num font-medium", value >= 70 ? "text-ember" : "text-ink/80")}>{value}</span>
      <span className="sr-only">virality</span>
    </span>
  );
}

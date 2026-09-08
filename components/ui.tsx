"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Glass({
  className, children, lit = true, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { lit?: boolean }) {
  return (
    <div className={cn("glass rounded-module", lit && "glass-lit", className)} {...rest}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("eyebrow", className)}>{children}</p>;
}

/**
 * SIGNATURE ELEMENT — the momentum capsule.
 *
 * Control Centre's brightness slider, borrowed as a data readout. The fill is
 * the score; the notch behind it is the threshold where the label changes.
 * Used for trend momentum and opportunity score so both read as one instrument.
 */
export function Capsule({
  value, tone = "accent", label, threshold, estimated = false,
}: {
  value: number;
  tone?: "accent" | "ember";
  label?: string;
  threshold?: number;
  estimated?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "ember" ? "rgb(var(--ember))" : "rgb(var(--accent))";
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="readout text-[2.25rem] font-semibold leading-none tracking-tight">
          {pct}
          <span className="text-faint text-base font-normal"> / 100</span>
        </span>
        {label && (
          <span
            className="readout text-[0.7rem] font-semibold uppercase tracking-[0.12em]"
            style={{ color }}
          >
            {label}
          </span>
        )}
      </div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-pill"
        style={{ background: "rgb(var(--hair) / 0.09)" }}
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ? `${label} ${pct} out of 100` : `${pct} out of 100`}
      >
        {typeof threshold === "number" && (
          <span
            className="absolute top-0 h-full w-px"
            style={{ left: `${threshold}%`, background: "rgb(var(--hair) / 0.28)" }}
            aria-hidden
          />
        )}
        <motion.span
          className="absolute inset-y-0 left-0 rounded-pill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
        />
      </div>
      {estimated && (
        <p className="readout mt-1.5 text-[0.65rem] uppercase tracking-[0.1em] text-faint">
          AI-estimated
        </p>
      )}
    </div>
  );
}

/** Provenance and claim-strength markers. Deliberately unglamorous. */
export function Tag({
  children, tone = "neutral", className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "ember" | "outline";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[rgb(var(--hair)/0.06)] text-muted",
    accent: "text-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.11)]",
    ember: "text-[rgb(var(--ember))] bg-[rgb(var(--ember)/0.12)]",
    outline: "text-faint border border-[rgb(var(--hair)/0.14)]",
  };
  return (
    <span
      className={cn(
        "readout inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-[3px] text-[0.65rem] font-semibold uppercase tracking-[0.09em]",
        tones[tone], className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot({ ok = true }: { ok?: boolean }) {
  return (
    <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60"
        style={{ background: ok ? "rgb(var(--accent))" : "rgb(var(--ember))" }}
      />
      <span
        className="relative inline-flex h-1.5 w-1.5 rounded-full"
        style={{ background: ok ? "rgb(var(--accent))" : "rgb(var(--ember))" }}
      />
    </span>
  );
}

export function Empty({ title, action }: { title: string; action: string }) {
  return (
    <Glass className="px-6 py-14 text-center">
      <p className="text-[0.95rem] font-medium">{title}</p>
      <p className="mt-1.5 text-sm text-muted">{action}</p>
    </Glass>
  );
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

export const riseIn = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const } },
};

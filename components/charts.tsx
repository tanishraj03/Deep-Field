"use client";

import { useState } from "react";
import { cn, compact } from "@/lib/utils";

/**
 * Small, dependency-free charts. Thin marks rounded at the data end, a 2px
 * gap between bars, a recessive baseline, and a hover tooltip on every mark.
 * Region colors come from the validated India/Global pair in globals.css.
 */

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export interface StackSeries { key: string; label: string; color: string }

/** Daily bars, optionally stacked. Two series max here, both in the legend. */
export function DailyBars({
  data, series, height = 120, className,
}: {
  data: ({ date: string } & Record<string, number | string>)[];
  series: StackSeries[];
  height?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((a, s) => a + Number(d[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className={cn("relative", className)}>
      {series.length > 1 && (
        <div className="mb-2 flex gap-3 text-[0.6875rem] text-muted">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.date}
            className="group relative flex h-full flex-1 cursor-default flex-col justify-end"
            onMouseEnter={() => setHover(i)}
          >
            <div className={cn("flex flex-col-reverse gap-[2px] transition-opacity", hover !== null && hover !== i && "opacity-45")}>
              {series.map((s, si) => {
                const v = Number(d[s.key] ?? 0);
                if (!v) return null;
                const top = si === series.length - 1 || series.slice(si + 1).every((x) => !Number(d[x.key] ?? 0));
                return (
                  <div
                    key={s.key}
                    style={{ height: Math.max(2, (v / max) * (height - 4)), background: s.color }}
                    className={cn(top ? "rounded-t-[4px]" : "")}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-hair/10" />
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6875rem] text-faint">
        <span>{data[0] ? fmtDate(data[0].date) : ""}</span>
        <span>{data.at(-1) ? fmtDate(data.at(-1)!.date) : ""}</span>
      </div>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-[0.6875rem] text-canvas shadow-lg"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <p className="font-semibold">{fmtDate(h.date)}</p>
          {series.map((s) => (
            <p key={s.key} className="num flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              {s.label}: {Number(h[s.key] ?? 0).toLocaleString("en-US")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** A compact trend line with a hover readout. One series; the title names it. */
export function Sparkline({
  values, labels, height = 36, color = "rgb(var(--global))", className, unit = "",
}: {
  values: number[]; labels?: string[]; height?: number; color?: string; className?: string; unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return <div className={className} style={{ height }} />;
  const w = 100;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - (v / max) * (height - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${d} L${w},${height} L0,${height} Z`;

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <path d={area} fill={color} opacity={0.1} />
        <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && pts[hover] && (
          <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={height} stroke="rgb(var(--ink))" strokeOpacity={0.25} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {hover !== null && pts[hover] && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[0.6875rem] text-canvas"
          style={{ left: `${(pts[hover][0] / w) * 100}%` }}
        >
          <span className="num font-semibold">{compact(values[hover])}{unit}</span>
          {labels?.[hover] && <span className="opacity-70"> · {fmtDate(labels[hover])}</span>}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for ranked lists (communities). Labels are text, never color. */
export function RankBars({ rows, max }: { rows: { label: string; value: number; region?: "IN" | "GLOBAL"; href?: string }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="group">
          <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
            {r.href
              ? <a href={r.href} target="_blank" rel="noreferrer" className="truncate hover:text-accent">{r.label}</a>
              : <span className="truncate">{r.label}</span>}
            <span className="num shrink-0 text-xs text-muted">{r.value.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-1 h-1 rounded-pill bg-hair/[0.06]">
            <div
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(2, (r.value / top) * 100)}%`,
                background: r.region === "IN" ? "rgb(var(--india))" : r.region === "GLOBAL" ? "rgb(var(--global))" : "rgb(var(--ink) / 0.5)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { ExternalLink, Music2, Search } from "lucide-react";
import { nicheLabel } from "@/lib/niches";
import type { RegionFilter, Signal, SignalsScan, TrendSize } from "@/lib/types";
import { cn, compact, relativeTime } from "@/lib/utils";
import { Card, Eyebrow, Flag } from "./ui";

const PER_REGION = 10;

/** "10K+ on Bluesky · 52 articles · 50M YouTube views", or nothing when it wasn't sized. */
function SizeLine({ size }: { size?: TrendSize }) {
  if (!size) return null;
  const parts = [
    size.bluesky !== null && size.bluesky > 0 ? `${compact(size.bluesky)}${size.blueskyCapped ? "+" : ""} Bluesky posts` : null,
    size.news !== null && size.news > 0 ? `${size.news} ${size.news === 1 ? "article" : "articles"}` : null,
    size.youtubeViews ? `${compact(size.youtubeViews)} YouTube views` : null,
  ].filter(Boolean);
  if (!parts.length) return <span className="text-faint">barely mentioned elsewhere yet</span>;
  return <span className="num">{parts.join(" · ")}</span>;
}

function XColumn({ title, region, trends }: { title: string; region: "IN" | "GLOBAL"; trends: Signal[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Flag region={region} />{title}</p>
      <ol className="divide-y divide-hair/[0.06]">
        {trends.slice(0, PER_REGION).map((s, i) => (
          <li key={s.id} className="group flex items-start gap-3 py-2">
            <span className="num w-5 shrink-0 pt-0.5 text-right text-xs text-faint">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-[0.875rem] font-medium hover:text-accent">{s.title}</a>
                {s.niche && <span className="text-[0.6875rem] text-faint">{nicheLabel(s.niche)}</span>}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-muted"><SizeLine size={s.size} /></p>
            </div>
            <Link href={`/explore?q=${encodeURIComponent(s.size?.query ?? s.title.replace(/^#/, ""))}`} aria-label={`Research ${s.title}`}
              className="mt-0.5 shrink-0 rounded-pill p-1.5 text-faint opacity-60 transition hover:bg-hair/[0.06] hover:text-ink group-hover:opacity-100">
              <Search className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * What's trending on X, India and worldwide. X itself gives only the order,
 * so each trend carries how big the same subject is on platforms that
 * publish numbers: Bluesky, Google News and YouTube.
 */
export function XTrendsPanel({ signals, region }: { signals: SignalsScan; region: RegionFilter }) {
  const of = (r: "IN" | "GLOBAL") => signals.signals.filter((s) => s.source === "x" && s.region === r).sort((a, b) => b.value - a.value);
  const IN = region !== "GLOBAL" ? of("IN") : [];
  const GL = region !== "IN" ? of("GLOBAL") : [];
  if (!IN.length && !GL.length) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[0.75rem] font-bold text-canvas">𝕏</span>
          Trending on X
        </h2>
        <span className="text-[0.6875rem] text-faint">updated {relativeTime(signals.scannedAt)}</span>
      </div>
      <div className={cn("grid gap-x-8 gap-y-4", IN.length && GL.length && "md:grid-cols-2")}>
        {IN.length > 0 && <XColumn title="India" region="IN" trends={IN} />}
        {GL.length > 0 && <XColumn title="Worldwide" region="GLOBAL" trends={GL} />}
      </div>
      <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
        X&apos;s trending order, from getdaytrends.com. X shares no counts for free, so each trend shows how much the same subject is being talked about elsewhere in the last two days (YouTube: this week&apos;s top videos, for the top five).
      </p>
    </Card>
  );
}

/**
 * The sounds Reels are being built on this week. Instagram publishes no
 * trends and Meta's API has none, so this is CreatorDB's free weekly chart:
 * global and mostly US, audio only.
 */
export function InstagramAudioPanel({ data }: { data: NonNullable<SignalsScan["instagramAudio"]> }) {
  if (!data.items.length) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md text-white" style={{ background: "linear-gradient(135deg,#F58529,#DD2A7B 50%,#8134AF)" }}>
            <Music2 className="h-3.5 w-3.5" />
          </span>
          Trending on Instagram
        </h2>
        <span className="text-[0.6875rem] text-faint">Reels audio{data.week ? ` · week of ${data.week.replace(/, \d{4}$/, "")}` : ""}</span>
      </div>
      <ol className="divide-y divide-hair/[0.06]">
        {data.items.slice(0, PER_REGION).map((a) => (
          <li key={`${a.rank}-${a.song}`} className="flex items-start gap-3 py-2">
            <span className="num w-5 shrink-0 pt-0.5 text-right text-xs text-faint">{a.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.875rem] font-medium">{a.song} <span className="font-normal text-muted">· {a.artist}</span></p>
              <p className="mt-0.5 truncate text-[0.6875rem] text-muted">
                {a.trend}
                {a.reels && <span className="num text-faint"> · {a.reels} Reels</span>}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {a.heat !== null && <span className={cn("num text-sm font-semibold leading-none", a.heat >= 70 ? "text-ember" : "")}>{a.heat}</span>}
              {a.momentum && <span className={cn("text-[0.625rem]", /rising/i.test(a.momentum) ? "text-rise" : "text-faint")}>{a.momentum}</span>}
            </div>
          </li>
        ))}
      </ol>
      <a href={data.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] text-faint hover:text-ink">
        From CreatorDB&apos;s weekly chart: global, mostly US, audio only<ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  );
}

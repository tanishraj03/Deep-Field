"use client";

import { ChevronDown, ExternalLink, Music2 } from "lucide-react";
import type { RegionFilter, SignalsScan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, Flag } from "./ui";

const PER_REGION = 10;

function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] text-faint hover:text-ink">
      {children}<ExternalLink className="h-3 w-3" />
    </a>
  );
}

function IndiaColumn({ data }: { data: NonNullable<SignalsScan["indiaAudio"]> }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Flag region="IN" />India</p>
      <ol className="divide-y divide-hair/[0.06]">
        {data.items.slice(0, PER_REGION).map((a) => (
          <li key={`${a.rank}-${a.song}`} className="flex items-start gap-3 py-2">
            <span className="num w-5 shrink-0 pt-0.5 text-right text-xs text-faint">{a.rank}</span>
            <div className="min-w-0 flex-1">
              <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-[0.875rem] font-medium hover:text-accent">
                {a.song} <span className="font-normal text-muted">· {a.artist}</span>
              </a>
              <p className="num mt-0.5 truncate text-[0.6875rem] text-muted">
                {a.language && <>{a.language} · </>}
                {a.days !== null && <>{a.days} {a.days === 1 ? "day" : "days"} on the chart</>}
                {a.peak !== null && <span className="text-faint"> · peak #{a.peak}</span>}
              </p>
            </div>
            {a.move && (
              <span className={cn("num shrink-0 pt-0.5 text-[0.6875rem] font-medium",
                a.move.startsWith("+") || /new|re/i.test(a.move) ? "text-rise" : "text-fall")}>
                {/new/i.test(a.move) ? "New" : /re/i.test(a.move) ? "Back" : a.move}
              </span>
            )}
          </li>
        ))}
      </ol>
      <Source href="https://charts.spotify.com/charts/view/regional-in-daily/latest">Spotify India&apos;s daily chart: Instagram has no India chart, and Indian Reels run on these songs</Source>
    </div>
  );
}

function GlobalColumn({ data }: { data: NonNullable<SignalsScan["instagramAudio"]> }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Flag region="GLOBAL" />Global</p>
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
      <Source href={data.url}>CreatorDB&apos;s weekly Reels audio chart{data.week ? `, week of ${data.week.replace(/, \d{4}$/, "")}` : ""} · mostly US</Source>
    </div>
  );
}

/**
 * The sounds Reels are being built on, folded away until opened. Instagram
 * publishes no audio trends and Meta's API has none, so: Global is
 * CreatorDB's free weekly Reels audio chart; India, which no one charts, is
 * Spotify India's daily top songs, the songs Indian Reels are made with.
 * Follows the region filter.
 */
export function InstagramAudioPanel({ signals, region }: { signals: SignalsScan; region: RegionFilter }) {
  const india = region !== "GLOBAL" && signals.indiaAudio?.items.length ? signals.indiaAudio : null;
  const global = region !== "IN" && signals.instagramAudio?.items.length ? signals.instagramAudio : null;
  if (!india && !global) return null;
  const peek = [...(india?.items ?? []), ...(global?.items ?? [])].slice(0, 3).map((a) => a.song.replace(/\s*\(.*$/, ""));

  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#F58529,#DD2A7B 50%,#8134AF)" }}>
            <Music2 className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.95rem] font-semibold tracking-tight">Trending audio on Instagram</span>
            <span className="block truncate text-xs text-muted">{peek.join(" · ")}</span>
          </span>
          <span className="shrink-0 text-xs text-faint group-open:hidden">Show</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
        </summary>
        <div className={cn("grid gap-x-8 gap-y-5 border-t px-5 pb-5 pt-3", india && global && "md:grid-cols-2")}>
          {india && <IndiaColumn data={india} />}
          {global && <GlobalColumn data={global} />}
        </div>
      </details>
    </Card>
  );
}

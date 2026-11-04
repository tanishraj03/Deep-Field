"use client";

import { ExternalLink, Music2 } from "lucide-react";
import type { SignalsScan } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const PER_REGION = 10;

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

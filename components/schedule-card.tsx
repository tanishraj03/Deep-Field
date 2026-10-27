"use client";

import { useState } from "react";
import { Check, Clock, Loader2 } from "lucide-react";
import type { Schedule } from "@/lib/schedule";
import { cn, relativeTime } from "@/lib/utils";
import { Card } from "./ui";

const label = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;

/** The daily automatic scan: on or off, and at what hour (India time). */
export function ScheduleCard({ initial, initialNext }: { initial: Schedule; initialNext: string }) {
  const [s, setS] = useState(initial);
  const [next, setNext] = useState(initialNext);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const save = async (patch: Partial<Pick<Schedule, "hour" | "enabled">>) => {
    setS((cur) => ({ ...cur, ...patch }));
    setState("saving");
    try {
      const res = await fetch("/api/schedule", { method: "PUT", body: JSON.stringify(patch) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setS(json.schedule);
      setNext(json.next);
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("error");
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-hair/[0.06]">
          <Clock className="h-4 w-4 text-muted" />
        </span>
        <div>
          <p className="font-medium">Daily scan</p>
          <p className="mt-0.5 text-sm text-muted">
            Every niche and the cross-internet signals, once a day.{" "}
            <span className="text-ink/80">Next: {next}</span>
            {s.lastRunAt && <> · last ran {relativeTime(s.lastRunAt)}</>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={s.hour}
          disabled={!s.enabled}
          onChange={(e) => save({ hour: Number(e.target.value) })}
          aria-label="Scan time (India time)"
          className="h-9 rounded-pill bg-hair/[0.06] px-3 text-[0.8125rem] font-medium outline-none ring-accent/40 focus:ring-1 disabled:opacity-40"
        >
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{label(h)} IST</option>)}
        </select>
        <button
          role="switch"
          aria-checked={s.enabled}
          aria-label="Automatic daily scan"
          onClick={() => save({ enabled: !s.enabled })}
          className={cn("relative h-6 w-11 shrink-0 rounded-pill transition-colors", s.enabled ? "bg-rise" : "bg-hair/20")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", s.enabled ? "translate-x-[22px]" : "translate-x-0.5")} />
        </button>
        <span className="w-4">
          {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
          {state === "saved" && <Check className="h-3.5 w-3.5 text-rise" />}
        </span>
      </div>
      {state === "error" && <p className="text-xs text-fall">Couldn&apos;t save. Try again.</p>}
    </Card>
  );
}

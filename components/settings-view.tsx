"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Eyebrow, Glass, LiveDot, Tag } from "./ui";
import { describePrefs, isEmptyFeed, loadPrefs, type Prefs } from "@/lib/prefs";
import { useTheme } from "./theme";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/lib/system-status";

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="hairline flex items-baseline justify-between gap-4 py-2.5 first:border-0 first:pt-0">
      <span className="text-[0.875rem] text-muted">{label}</span>
      <span className="readout inline-flex items-center gap-1.5 text-right text-[0.8125rem] font-medium">
        {ok !== undefined && <LiveDot ok={ok} />}
        {value}
      </span>
    </div>
  );
}

function Meter({ used, cap, label }: { used: number; cap: number; label: string }) {
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const hot = pct >= 80;
  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[0.875rem] text-muted">{label}</span>
        <span className="readout text-[0.8125rem] font-semibold tabular-nums">
          {used} <span className="text-faint">/ {cap}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-pill" style={{ background: "rgb(var(--hair) / 0.09)" }}>
        <span
          className="block h-full rounded-pill transition-all duration-700"
          style={{ width: `${pct}%`, background: hot ? "rgb(var(--ember))" : "rgb(var(--accent))" }}
        />
      </div>
    </div>
  );
}

function ActionButton({ label, endpoint, busyLabel }: { label: string; endpoint: string; busyLabel: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setState("busy"); setMessage("");
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("done");
        setMessage(typeof json.error === "string" ? json.error : "");
        setTimeout(() => setState("idle"), 2500);
      } else {
        setState("error");
        setMessage(json.error ?? `Failed with status ${res.status}`);
      }
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <div>
      <button
        onClick={run}
        disabled={state === "busy"}
        className={cn(
          "press inline-flex items-center gap-2 rounded-pill px-4 py-2 text-[0.8125rem] font-semibold transition-colors",
          "bg-[rgb(var(--hair)/0.07)] hover:text-ink disabled:opacity-60",
        )}
      >
        {state === "busy" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {state === "done" && <Check className="h-3.5 w-3.5" />}
        {state === "busy" ? busyLabel : state === "done" ? "Sent" : label}
      </button>
      {message && (
        <p className="readout mt-2 text-[0.7rem]" style={{ color: "rgb(var(--ember))" }}>{message}</p>
      )}
    </div>
  );
}

function FeedPanel() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => setPrefs(loadPrefs()), []);

  return (
    <Glass className="p-6">
      <Eyebrow className="mb-3">Your feed</Eyebrow>
      {prefs === null ? (
        <p className="text-[0.8125rem] text-faint">Reading preferences…</p>
      ) : (
        <>
          <Row
            label="Filter"
            value={isEmptyFeed(prefs) ? "Everything — no filter" : describePrefs(prefs)}
          />
          <Row
            label="Set up"
            value={prefs.completedAt ? new Date(prefs.completedAt).toLocaleDateString() : "Not yet"}
            ok={Boolean(prefs.completedAt)}
          />
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            The feed filters what you see. Collection and scoring are unaffected — every
            item is still gathered, and any screen can show everything in one click.
          </p>
        </>
      )}
      <div className="mt-4">
        <Link
          href="/welcome"
          className="press inline-flex items-center gap-1.5 rounded-pill bg-[rgb(var(--hair)/0.06)] px-3.5 py-2 text-[0.8125rem] font-semibold text-muted transition-colors hover:text-ink"
        >
          Rebuild my feed <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Glass>
  );
}

export function SettingsView({ status }: { status: SystemStatus }) {
  const { theme, setTheme } = useTheme();
  const allFree = status.blocked.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Eyebrow>System</Eyebrow>
        <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">Settings</h1>
      </header>

      {/* FREE MODE — the thing you actually want to check every week */}
      <Glass className="p-6">
        <div className="flex items-center gap-2">
          <Eyebrow>Free mode</Eyebrow>
          <span className="ml-auto">
            <Tag tone={allFree ? "accent" : "ember"}>
              {allFree ? "🟢 All systems free" : "🔴 Blocked — paid service"}
            </Tag>
          </span>
        </div>

        <div className="mt-4">
          <Row label="AI" value={status.ai.provider} ok />
          <Row label="Database" value={`${status.database.backend} · free tier`} ok={status.database.persistent} />
          <Row label="Hosting" value="Vercel free / Hobby" ok />
          <Row label="Automation" value="GitHub Actions · free minutes" ok={status.cron.configured} />
          <Row label="Slack" value={status.slack.connected ? `Connected · ${status.slack.channel}` : "Not connected"} ok={status.slack.connected} />
        </div>

        {allFree ? (
          <p className="hairline mt-4 pt-3 text-[0.8125rem] text-muted">
            No paid services detected. Nothing in this deployment can generate a charge.
          </p>
        ) : (
          <ul className="hairline mt-4 space-y-2 pt-3">
            {status.blocked.map((b) => (
              <li key={b.service} className="text-[0.8125rem]" style={{ color: "rgb(var(--ember))" }}>
                <span className="font-semibold">{b.service}</span> — {b.reason}
              </li>
            ))}
          </ul>
        )}
      </Glass>

      {/* Free usage */}
      <Glass className="p-6">
        <Eyebrow className="mb-3">Free usage</Eyebrow>
        <Meter used={status.ai.requestsToday} cap={status.ai.dailyCap} label="AI requests today" />
        <Meter used={status.ai.requestsThisMonth} cap={status.ai.monthlyCap} label="AI requests this month" />
        <Row label="Estimated tokens today" value={status.ai.estimatedTokensToday.toLocaleString()} />
        {status.ai.blocked && (
          <p className="mt-3 rounded-tile px-3 py-2.5 text-[0.8125rem] font-medium"
             style={{ background: "rgb(var(--ember) / 0.1)", color: "rgb(var(--ember))" }}>
            AI free limit nearly reached. {status.ai.blockReason} Collection continues without AI —
            scores and deduplication are unaffected.
          </p>
        )}
      </Glass>

      {/* Briefing */}
      <Glass className="p-6">
        <Eyebrow className="mb-3">Briefing</Eyebrow>
        <Row label="Delivery time" value="8:00 AM IST" />
        <Row label="Slack channel" value={status.slack.channel} ok={status.slack.connected} />
        <Row label="Scheduler" value={status.cron.configured ? "GitHub Actions" : "Not configured"} ok={status.cron.configured} />
        <p className="mt-2 text-[0.8125rem] text-muted">{status.slack.note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton label="Send test to Slack" busyLabel="Sending" endpoint="/api/slack/test" />
        </div>
      </Glass>

      <FeedPanel />

      {/* Appearance */}
      <Glass className="p-6">
        <Eyebrow className="mb-3">Appearance</Eyebrow>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              className={cn(
                "press flex-1 rounded-tile py-2.5 text-[0.8125rem] font-semibold capitalize transition-colors",
                theme === t ? "text-ink" : "text-faint hover:text-muted",
              )}
              style={{ background: theme === t ? "rgb(var(--hair) / 0.08)" : "rgb(var(--hair) / 0.035)" }}
            >
              {t}
            </button>
          ))}
        </div>
      </Glass>

      <Link
        href="/settings/diagnostics"
        className="press glass glass-lit flex items-center justify-between rounded-module px-6 py-4"
      >
        <span>
          <span className="block text-[0.9375rem] font-semibold">Diagnostics</span>
          <span className="readout block text-[0.75rem] text-faint">
            Source health, quota, last ingestion
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-faint" />
      </Link>

      <p className="readout pb-2 text-center text-[0.7rem] text-faint">
        Free-tier limits apply. This app never upgrades a service automatically.
      </p>
    </div>
  );
}

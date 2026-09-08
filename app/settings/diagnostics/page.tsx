import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Eyebrow, Glass, LiveDot, Tag } from "@/components/ui";
import { getSystemStatus } from "@/lib/snapshot";
import { enabledSources } from "@/lib/sources";
import { istClock, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <p className="readout mt-1 text-[1.375rem] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

export default async function DiagnosticsPage() {
  const status = await getSystemStatus();
  const run = status.lastRun;
  const sources = enabledSources();
  const failed = run?.runs.filter((r) => !r.ok) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/settings"
        className="press inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>

      <header>
        <Eyebrow>System</Eyebrow>
        <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">Diagnostics</h1>
        <p className="readout mt-2 text-[0.75rem] text-faint">
          {run?.finishedAt
            ? `Last ingestion finished ${istClock(new Date(run.finishedAt))} IST · ${relativeTime(run.finishedAt)}`
            : "No ingestion has run yet"}
          {status.mode === "mock" && " · mock data"}
        </p>
      </header>

      <Glass className="grid grid-cols-2 gap-5 p-6 sm:grid-cols-3">
        <Stat label="Sources checked" value={String(run?.sourcesChecked ?? 0)} />
        <Stat label="Sources failed" value={String(run?.sourcesFailed ?? 0)} />
        <Stat label="Raw items" value={String(run?.rawItems ?? 0)} />
        <Stat label="Duplicates removed" value={String(run?.duplicatesRemoved ?? 0)} />
        <Stat label="New signals" value={String(run?.newSignals ?? 0)} />
        <Stat label="AI requests" value={String(run?.aiRequests ?? 0)} />
      </Glass>

      <Glass className="p-6">
        <Eyebrow className="mb-3">Service health</Eyebrow>
        {[
          { label: "AI quota", value: status.ai.blocked ? status.ai.blockReason ?? "Capped" : `${status.ai.requestsToday}/${status.ai.dailyCap} today`, ok: !status.ai.blocked },
          { label: "Database", value: status.database.note, ok: status.database.persistent },
          { label: "Slack", value: status.slack.note, ok: status.slack.connected },
          { label: "Scheduler", value: status.cron.note, ok: status.cron.configured },
          { label: "Last brief", value: run?.aiSkipped ? "Written without AI" : "Written with AI", ok: !run?.aiSkipped },
        ].map((r) => (
          <div key={r.label} className="hairline flex items-baseline justify-between gap-4 py-2.5 first:border-0 first:pt-0">
            <span className="text-[0.875rem] text-muted">{r.label}</span>
            <span className="inline-flex items-center gap-1.5 text-right text-[0.8125rem]">
              <LiveDot ok={r.ok} />{r.value}
            </span>
          </div>
        ))}
        {run?.aiSkipReason && (
          <p className="mt-3 rounded-tile px-3 py-2.5 text-[0.8125rem]"
             style={{ background: "rgb(var(--ember) / 0.09)", color: "rgb(var(--ember))" }}>
            {run.aiSkipReason}
          </p>
        )}
      </Glass>

      {failed.length > 0 && (
        <Glass className="p-6">
          <Eyebrow className="mb-3">Sources unavailable this run</Eyebrow>
          <ul className="space-y-2">
            {failed.map((f) => (
              <li key={f.source} className="flex flex-wrap items-baseline gap-2 text-[0.8125rem]">
                <span className="font-medium">{f.source}</span>
                <span className="readout text-[0.7rem] text-faint">{f.error}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] text-muted">
            Failed sources are skipped, not retried into a rate limit. Coverage is reduced for the
            day and the count is shown on every screen rather than hidden.
          </p>
        </Glass>
      )}

      <Glass className="p-6">
        <Eyebrow className="mb-3">Configured sources · {sources.length}</Eyebrow>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[0.8125rem] text-muted">
              <Tag>{s.kind}</Tag>
              <span className="truncate">{s.name}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.8125rem] text-muted">
          Every source is a public feed or a documented keyless API. Edit{" "}
          <code className="readout text-[0.75rem]">lib/sources/registry.ts</code> to add more.
        </p>
      </Glass>
    </div>
  );
}

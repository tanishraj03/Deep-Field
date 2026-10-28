import Link from "next/link";
import { PeopleTable, PlatformControls } from "@/components/admin";
import { ScheduleCard } from "@/components/schedule-card";
import { Card, Eyebrow, Stat } from "@/components/ui";
import { loadAdminData } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth/admin";
import { cn, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "logins", label: "Sign-ins" },
  { id: "platform", label: "Platform" },
  { id: "log", label: "Admin log" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
});

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "overview";
  const d = await loadAdminData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Service dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Who&apos;s using DeepField and how, and the switches that apply to everyone. Only you can see this page.
        </p>
      </div>

      <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b px-1" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <Link key={t.id} href={t.id === "overview" ? "/admin" : `/admin?tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
              tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
            {t.id === "people" && <span className="num ml-1.5 text-faint">{d.totals.people}</span>}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <Card className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
            <Stat label="People" value={d.totals.people} sub={`${d.totals.newWeek} new this week`} />
            <Stat label="Active today" value={d.totals.activeToday} sub={`${d.totals.activeWeek} this week`} />
            <Stat label="Sign-ins today" value={d.totals.loginsToday} sub={`${d.logins.length} recorded in all`} />
            <Stat label="Added their own keys" value={d.totals.withKeys} sub={`of ${d.totals.onboarded} fully signed up`} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <Eyebrow>Usage</Eyebrow>
              <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted">Explore searches</dt><dd className="num text-right font-medium">{d.totals.searches}</dd>
                <dt className="text-muted">Assistant chats</dt><dd className="num text-right font-medium">{d.totals.chats}</dd>
                <dt className="text-muted">Suspended accounts</dt><dd className="num text-right font-medium">{d.totals.suspended}</dd>
              </dl>
              <p className="mt-3 text-xs text-faint">Counted from when this dashboard was added.</p>
            </Card>
            <Card className="p-5">
              <Eyebrow>Data</Eyebrow>
              <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted">Niches with a scan</dt><dd className="num text-right font-medium">{d.data.niches}</dd>
                <dt className="text-muted">Conversations</dt><dd className="num text-right font-medium">{d.data.topics}</dd>
                <dt className="text-muted">Newest scan</dt><dd className="text-right font-medium">{d.data.newestScan ? relativeTime(d.data.newestScan) : "–"}</dd>
                <dt className="text-muted">Oldest scan</dt><dd className="text-right font-medium">{d.data.oldestScan ? relativeTime(d.data.oldestScan) : "–"}</dd>
                <dt className="text-muted">Daily scan</dt><dd className="text-right font-medium">{d.schedule.next}</dd>
                <dt className="text-muted">Storage</dt><dd className="text-right font-medium">{d.storage.backend === "supabase" ? "Supabase" : "Local file"}</dd>
              </dl>
            </Card>
          </div>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <Eyebrow>Latest sign-ins</Eyebrow>
              <Link href="/admin?tab=logins" className="text-xs text-accent hover:underline">All sign-ins</Link>
            </div>
            <Logins entries={d.logins.slice(0, 6)} />
          </section>
        </div>
      )}

      {tab === "people" && <PeopleTable people={d.people} />}

      {tab === "logins" && (
        <section className="space-y-2">
          <Logins entries={d.logins} />
          <p className="text-xs text-faint">The last 300 sign-ins, newest first. Location is the city Vercel reports; IP addresses aren&apos;t kept.</p>
        </section>
      )}

      {tab === "platform" && (
        <div className="space-y-8">
          <PlatformControls initial={d.platform} />
          <section>
            <Eyebrow className="mb-3">Daily scan</Eyebrow>
            <ScheduleCard initial={d.schedule.value} initialNext={d.schedule.next} />
          </section>
        </div>
      )}

      {tab === "log" && (
        <section className="space-y-2">
          {d.log.length ? (
            <Card className="divide-y">
              {d.log.map((e, i) => (
                <div key={i} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="w-32 shrink-0 text-xs text-faint">{when(e.at)}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {e.action}{e.target !== "platform" && <span className="text-muted"> · {e.target}</span>}
                    {e.detail && <span className="block text-xs text-muted">{e.detail}</span>}
                  </span>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="px-4 py-10 text-center text-sm text-muted">Nothing changed from here yet.</Card>
          )}
          <p className="text-xs text-faint">Every change made from this dashboard, newest first.</p>
        </section>
      )}
    </div>
  );
}

function Logins({ entries }: { entries: Awaited<ReturnType<typeof loadAdminData>>["logins"] }) {
  if (!entries.length) return <Card className="px-4 py-10 text-center text-sm text-muted">No sign-ins recorded yet. They appear from the next one.</Card>;
  return (
    <Card className="divide-y">
      {entries.map((l, i) => (
        <div key={i} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_1fr_12rem_10rem] sm:items-center sm:gap-4">
          <span className="text-xs text-faint">{when(l.at)}</span>
          <span className="min-w-0">
            <span className="font-medium">{l.name}</span>
            <span className="block truncate text-xs text-muted">{l.email}</span>
          </span>
          <span className="text-xs text-muted">{[l.city, l.country].filter(Boolean).join(", ") || "Location unknown"}</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            {l.device ?? "Unknown device"}
            {l.created && <span className="rounded-pill bg-rise/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-rise">New</span>}
          </span>
        </div>
      ))}
    </Card>
  );
}

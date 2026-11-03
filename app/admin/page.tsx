import { AdminTabs, PeopleTable, PlatformControls } from "@/components/admin";
import { SuggestionQueue } from "@/components/admin-suggestions";
import { ScheduleCard } from "@/components/schedule-card";
import { Card, Eyebrow, Stat } from "@/components/ui";
import { loadAdminData, type AdminData } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth/admin";
import { learning, MIN_RESULTS, MIN_VOTES, type Learning } from "@/lib/feedback";
import { nicheLabel } from "@/lib/niches";
import { MIN_PEOPLE, researchTrends, type Researched } from "@/lib/research";
import { allSuggestions, type Suggestion } from "@/lib/suggestions";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TAB_IDS = ["overview", "people", "logins", "learning", "communities", "platform", "log"] as const;
type Tab = (typeof TAB_IDS)[number];

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
});

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const [{ tab: raw }, d, learned, suggestions, researched] = await Promise.all([
    searchParams, loadAdminData(), learning(), allSuggestions().catch((): Suggestion[] => []), researchTrends(20).catch((): Researched[] => []),
  ]);
  const tab: Tab = (TAB_IDS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "overview";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Service dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Who&apos;s using DeepField and how, and the switches that apply to everyone. Only you can see this page.
        </p>
      </div>

      {/* Every tab is rendered here, from one read of the store; switching
          between them happens in the browser, without asking the server again. */}
      <AdminTabs
        initial={tab}
        counts={{ people: d.totals.people, communities: suggestions.filter((s) => s.status === "pending").length || undefined }}
        panels={{
          overview: <Overview d={d} />,
          people: <PeopleTable people={d.people} />,
          logins: <SignIns d={d} />,
          learning: <LearningPanel l={learned} researched={researched} />,
          communities: <SuggestionQueue initial={suggestions} />,
          platform: <Platform d={d} />,
          log: <AdminLog d={d} />,
        }}
      />
    </div>
  );
}

function Overview({ d }: { d: AdminData }) {
  return (
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
            <dt className="text-muted">Newest scan</dt><dd className="text-right font-medium">{d.data.newestScan ? relativeTime(d.data.newestScan) : "–"}</dd>
            <dt className="text-muted">Oldest scan</dt><dd className="text-right font-medium">{d.data.oldestScan ? relativeTime(d.data.oldestScan) : "–"}</dd>
            <dt className="text-muted">Daily scan</dt><dd className="text-right font-medium">{d.schedule.next}</dd>
            <dt className="text-muted">Storage</dt><dd className="text-right font-medium">{d.storage.backend === "supabase" ? "Supabase" : "Local file"}</dd>
          </dl>
        </Card>
      </div>
      <section>
        <Eyebrow className="mb-3">Latest sign-ins</Eyebrow>
        <Logins entries={d.logins.slice(0, 6)} />
      </section>
    </div>
  );
}

const CALL_LABEL = { make: "Make now", test: "Worth testing", skip: "Skip" } as const;

/** What DeepField has learned from creators: votes, results, the nudges they cause, and what people research. */
function LearningPanel({ l, researched }: { l: Learning; researched: Researched[] }) {
  const nudges = Object.entries(l.byNiche).filter(([, n]) => n.bias).sort((a, b) => Math.abs(b[1].bias) - Math.abs(a[1].bias));
  return (
    <div className="space-y-6">
      <Card className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Stat label="Creators giving feedback" value={l.people} />
        <Stat label="Verdict votes" value={l.votes} />
        <Stat label="Topics made" value={l.made} />
        <Stat label="Results reported" value={l.reported} sub={l.made ? `${Math.round((l.reported / l.made) * 100)}% of made` : undefined} />
      </Card>

      <section>
        <Eyebrow className="mb-3">How the calls are holding up</Eyebrow>
        <Card className="divide-y">
          {(["make", "test", "skip"] as const).map((c) => {
            const s = l.byCall[c];
            const votes = s.up + s.down;
            return (
              <div key={c} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_1fr_1fr] sm:items-center">
                <span className="font-medium">{CALL_LABEL[c]}</span>
                <span className="text-muted">{s.reported ? `${s.hits} of ${s.reported} beat the creator's usual (${Math.round((s.hits / s.reported) * 100)}%)` : `No results yet (${s.made} made)`}</span>
                <span className="text-muted">{votes ? `${s.up} agree, ${s.down} disagree` : "No votes yet"}</span>
              </div>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-faint">If the calls work, &quot;Make now&quot; should beat the creator&apos;s usual most often and &quot;Skip&quot; least.</p>
      </section>

      <section>
        <Eyebrow className="mb-3">Nudges in effect</Eyebrow>
        {nudges.length ? (
          <Card className="divide-y">
            {nudges.map(([id, n]) => (
              <div key={id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_4rem_1fr] sm:items-center">
                <span className="font-medium">{nicheLabel(id)}</span>
                <span className={`num font-semibold ${n.bias > 0 ? "text-rise" : "text-fall"}`}>{n.bias > 0 ? "+" : ""}{n.bias}</span>
                <span className="text-xs text-muted">{n.reasons.join(" · ")}</span>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="px-4 py-6 text-sm text-muted">
            None yet. A niche&apos;s verdicts start leaning once it has {MIN_RESULTS}+ reported results, or {MIN_VOTES}+ votes mostly against one kind of call. Each nudge is capped at 7 points and shown as a reason on the verdict.
          </Card>
        )}
      </section>

      <section>
        <Eyebrow className="mb-3">What creators are researching · last 3 days</Eyebrow>
        {researched.length ? (
          <Card className="divide-y">
            {researched.map((r) => (
              <div key={r.query} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{r.query}{r.rising && <span className="ml-2 text-xs text-rise">rising</span>}</span>
                <span className="num text-xs text-muted">{r.people} creators</span>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="px-4 py-6 text-sm text-muted">Nothing yet. A search shows once {MIN_PEOPLE}+ different people have made it. Who searched is never stored in a way anyone can read, you included.</Card>
        )}
      </section>
    </div>
  );
}

function SignIns({ d }: { d: AdminData }) {
  return (
    <section className="space-y-2">
      <Logins entries={d.logins} />
      <p className="text-xs text-faint">The last 300 sign-ins, newest first. Location is the city Vercel reports; IP addresses aren&apos;t kept.</p>
    </section>
  );
}

function Platform({ d }: { d: AdminData }) {
  return (
    <div className="space-y-8">
      <PlatformControls initial={d.platform} />
      <section>
        <Eyebrow className="mb-3">Daily scan</Eyebrow>
        <ScheduleCard initial={d.schedule.value} initialNext={d.schedule.next} />
      </section>
    </div>
  );
}

function AdminLog({ d }: { d: AdminData }) {
  return (
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
  );
}

function Logins({ entries }: { entries: AdminData["logins"] }) {
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

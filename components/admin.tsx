"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, KeyRound, Megaphone, RotateCcw, Search, ShieldCheck, TriangleAlert } from "lucide-react";
import type { PersonRow } from "@/lib/admin-data";
import type { AnnouncementTone, PlatformSettings } from "@/lib/platform";
import { cn, relativeTime } from "@/lib/utils";
import { Badge, Button, Card } from "./ui";

async function send(url: string, method: "POST" | "PUT", body: unknown): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, error: "Couldn't reach DeepField. Check your connection." };
  }
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/* ───────────── tabs ───────────── */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "logins", label: "Sign-ins" },
  { id: "platform", label: "Platform" },
  { id: "log", label: "Admin log" },
] as const;
export type AdminTab = (typeof TABS)[number]["id"];

/**
 * The dashboard's sections. All of them arrive rendered in one response, so
 * switching is instant and asks the server for nothing; hidden ones stay
 * mounted, so a search typed in People is still there on the way back. The
 * address follows along (replaceState), so a reload opens the same tab.
 */
export function AdminTabs({ initial, panels, counts }: {
  initial: AdminTab; panels: Record<AdminTab, React.ReactNode>; counts?: Partial<Record<AdminTab, number>>;
}) {
  const [tab, setTab] = useState<AdminTab>(initial);
  const open = (id: AdminTab) => {
    setTab(id);
    window.history.replaceState(null, "", id === "overview" ? "/admin" : `/admin?tab=${id}`);
  };
  return (
    <>
      <div role="tablist" aria-label="Dashboard sections" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b px-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => open(t.id)}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[0.8125rem] font-medium transition-colors",
              tab === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
            {counts?.[t.id] !== undefined && <span className="num ml-1.5 text-faint">{counts[t.id]}</span>}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id}>
          {panels[t.id]}
        </div>
      ))}
    </>
  );
}

/* ───────────── people ───────────── */

/** Everyone who has signed in, searchable, with suspend and restore. */
export function PeopleTable({ people }: { people: PersonRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended" | "keys">("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const week = Date.now() - 7 * 86_400_000;
    return people.filter((p) =>
      (!needle || [p.name, p.email, p.username ?? ""].some((v) => v.toLowerCase().includes(needle))) &&
      (filter === "all" ||
        (filter === "suspended" && p.suspended) ||
        (filter === "keys" && p.keys.length > 0) ||
        (filter === "active" && Date.parse(p.lastSeenAt ?? p.lastLoginAt) > week)));
  }, [people, q, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-9 w-full items-center gap-2 rounded-pill bg-hair/[0.06] px-3.5 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or username"
            className="min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none placeholder:text-faint" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {([["all", "Everyone"], ["active", "Active this week"], ["keys", "Added keys"], ["suspended", "Suspended"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={cn("rounded-pill px-3 py-1.5 text-xs font-medium transition-colors", filter === v ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b text-[0.6875rem] uppercase tracking-[0.06em] text-faint">
              <th className="px-4 py-3 font-semibold">Person</th>
              <th className="px-3 py-3 font-semibold">Joined</th>
              <th className="px-3 py-3 font-semibold">Last seen</th>
              <th className="px-3 py-3 font-semibold">Logins</th>
              <th className="px-3 py-3 font-semibold">Usage</th>
              <th className="px-3 py-3 font-semibold">Niches</th>
              <th className="px-3 py-3 font-semibold">Keys</th>
              <th className="px-4 py-3 text-right font-semibold">Access</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => <PersonRowView key={p.id} p={p} />)}
          </tbody>
        </table>
        {!shown.length && <p className="px-4 py-10 text-center text-sm text-muted">Nobody matches that.</p>}
      </Card>
      <p className="text-xs text-faint">{shown.length} of {people.length} {people.length === 1 ? "person" : "people"}. Usage counts started with this dashboard, so older activity isn&apos;t included.</p>
    </div>
  );
}

function PersonRowView({ p }: { p: PersonRow }) {
  const a = p.activity;
  const usage = [
    a.searches && `${a.searches} ${a.searches === 1 ? "search" : "searches"}`,
    a.chats && `${a.chats} ${a.chats === 1 ? "chat" : "chats"}`,
    a.scans && `${a.scans} ${a.scans === 1 ? "scan" : "scans"}`,
  ].filter(Boolean);
  return (
    <tr className={cn("border-b align-top last:border-0", p.suspended && "bg-fall/[0.04]")}>
      <td className="px-4 py-3">
        <div className="flex items-start gap-2.5">
          {p.picture
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.picture} alt="" referrerPolicy="no-referrer" className="mt-0.5 h-7 w-7 shrink-0 rounded-full" />
            : <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hair/10 text-xs font-semibold">{p.name.slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-medium">
              {p.name}
              {p.admin && <Badge tone="accent"><ShieldCheck className="h-3 w-3" />Admin</Badge>}
              {p.serverKeys && <Badge tone="outline"><KeyRound className="h-3 w-3" />Server keys</Badge>}
              {p.suspended && <Badge tone="fall">Suspended</Badge>}
            </p>
            <p className="truncate text-xs text-muted">{p.email}</p>
            <p className="text-xs text-faint">{p.username ? `@${p.username}` : "Hasn't finished signing up"}{p.role ? ` · ${p.role}` : ""}</p>
            {p.suspended?.reason && <p className="mt-1 text-xs text-fall">Reason: {p.suspended.reason}</p>}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-muted">{day(p.createdAt)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-muted">{relativeTime(p.lastSeenAt ?? p.lastLoginAt)}</td>
      <td className="num px-3 py-3 text-muted">{p.loginCount ?? "–"}</td>
      <td className="px-3 py-3 text-xs text-muted">{usage.length ? usage.join(", ") : <span className="text-faint">Nothing yet</span>}</td>
      <td className="max-w-[12rem] px-3 py-3 text-xs text-muted">{p.niches.length ? p.niches.join(", ") : <span className="text-faint">None picked</span>}</td>
      <td className="max-w-[11rem] px-3 py-3 text-xs text-muted">{p.keys.length ? p.keys.join(", ") : <span className="text-faint">None</span>}</td>
      <td className="px-4 py-3 text-right"><AccessButton p={p} /></td>
    </tr>
  );
}

function AccessButton({ p }: { p: PersonRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (p.admin) return <span className="text-xs text-faint">Always on</span>;

  async function change(action: "suspend" | "restore") {
    let reason: string | null = null;
    if (action === "suspend") {
      reason = window.prompt(`Suspend ${p.name}? They'll be signed out straight away and won't be able to sign back in.\n\nReason (optional, only you see it):`, "");
      if (reason === null) return;
    }
    setBusy(true);
    setError(null);
    const r = await send("/api/admin/users", "POST", { uid: p.id, action, reason });
    setBusy(false);
    if (!r.ok) setError(r.error ?? "That didn't work.");
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {p.suspended
        ? <Button size="sm" loading={busy} onClick={() => change("restore")}><RotateCcw className="h-3.5 w-3.5" />Restore</Button>
        : <Button size="sm" variant="ghost" loading={busy} onClick={() => change("suspend")} className="text-fall hover:text-fall"><Ban className="h-3.5 w-3.5" />Suspend</Button>}
      {error && <p className="max-w-[10rem] text-[0.6875rem] text-fall" role="alert">{error}</p>}
    </div>
  );
}

/* ───────────── platform ───────────── */

function Toggle({ on, onChange, busy, label, hint }: { on: boolean; onChange: (v: boolean) => void; busy: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-6 p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      <button role="switch" aria-checked={on} aria-label={label} disabled={busy} onClick={() => onChange(!on)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-50", on ? "bg-rise" : "bg-hair/20")}>
        <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-[1.375rem]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

/** Sign-ups, user scans and the announcement banner. */
export function PlatformControls({ initial }: { initial: PlatformSettings }) {
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState(initial.announcement?.text ?? "");
  const [tone, setTone] = useState<AnnouncementTone>(initial.announcement?.tone ?? "info");
  const [saved, setSaved] = useState(false);

  async function save(what: string, body: Partial<Record<keyof PlatformSettings, unknown>>) {
    setBusy(what);
    setError(null);
    setSaved(false);
    const r = await send("/api/admin/platform", "PUT", body);
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "That didn't save."); return; }
    setP(r.platform as PlatformSettings);
    if (what === "announcement") setSaved(true);
  }

  return (
    <div className="space-y-6">
      <Card className="divide-y">
        <Toggle on={p.signupsOpen} busy={busy === "signups"} onChange={(v) => save("signups", { signupsOpen: v })}
          label="New sign-ups"
          hint={p.signupsOpen ? "Anyone with a Google account can create a DeepField account." : "Closed: only people who already have an account can sign in. You always can."} />
        <Toggle on={p.userScans} busy={busy === "scans"} onChange={(v) => save("scans", { userScans: v })}
          label="Let people refresh scans"
          hint={p.userScans ? "Signed-in people can rescan a niche with their own AI key, at most every 10 minutes." : "Off: niches only refresh with the daily scan. You can still run them."} />
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-2 font-medium"><Megaphone className="h-4 w-4 text-accent" />Announcement</p>
        <p className="mt-0.5 text-sm text-muted">A line at the top of every screen, for everyone signed in. Changes reach everyone within about 30 seconds.</p>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} maxLength={280} rows={2}
          placeholder="e.g. Instagram data is paused today while we fix a sign-in issue."
          className="mt-3 w-full resize-none rounded-xl bg-hair/[0.05] px-3.5 py-2.5 text-[0.8125rem] outline-none ring-1 ring-hair/10 focus:ring-accent/50" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {(["info", "warning"] as const).map((t) => (
              <button key={t} onClick={() => setTone(t)}
                className={cn("inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium", tone === t ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink")}>
                {t === "info" ? <Megaphone className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}{t === "info" ? "Note" : "Warning"}
              </button>
            ))}
            <span className="num ml-1 text-xs text-faint">{text.length}/280</span>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="flex items-center gap-1 text-xs text-rise"><Check className="h-3.5 w-3.5" />Live</span>}
            {p.announcement && (
              <Button size="sm" variant="ghost" loading={busy === "remove"} onClick={() => { setText(""); save("remove", { announcement: null }); }}>Take down</Button>
            )}
            <Button size="sm" variant="primary" loading={busy === "announcement"} disabled={!text.trim()} onClick={() => save("announcement", { announcement: { text, tone } })}>
              {p.announcement ? "Update" : "Publish"}
            </Button>
          </div>
        </div>
      </Card>

      {error && <p className="rounded-xl bg-fall/[0.1] px-3 py-2 text-xs text-fall" role="alert">{error}</p>}
    </div>
  );
}

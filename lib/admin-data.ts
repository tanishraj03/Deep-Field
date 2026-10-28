import { isAdmin, savedIntegrationsFrom, usersFrom, usesServerKeys } from "@/lib/auth/users";
import { INTEGRATION_BY_ID } from "@/lib/keys-catalog";
import { nicheLabel } from "@/lib/niches";
import {
  ADMIN_LOG_KEY, LOGINS_KEY, platformFrom, SETTINGS_KEY,
  type Activity, type AdminEntry, type LoginEntry, type PlatformSettings,
} from "@/lib/platform";
import { nextRun, SCHEDULE_KEY, scheduleFrom, type Schedule } from "@/lib/schedule";
import { store } from "@/lib/store";

/**
 * Everything the service dashboard shows, in three round trips to the store,
 * made at once: every account with its activity, the four small documents
 * (switches, schedule, sign-ins, admin log), and when each niche was last
 * scanned. Each trip costs ~200 ms, so this is what keeps the page quick; it
 * used to make ten, and read every scan in full to learn one timestamp.
 * Server only: it reads every account.
 */

export interface PersonRow {
  id: string;
  name: string;
  email: string;
  username: string | null;
  picture: string | null;
  createdAt: string;
  lastLoginAt: string;
  /** Last page load, to within ten minutes. */
  lastSeenAt: string | null;
  loginCount: number | null;
  niches: string[];
  role: string | null;
  /** Integration names they have saved a key for. Never the keys. */
  keys: string[];
  activity: Activity;
  suspended: { at: string; reason: string | null } | null;
  admin: boolean;
  serverKeys: boolean;
}

const DAY = 86_400_000;

export async function loadAdminData() {
  const [accounts, singles, scans, storage] = await Promise.all([
    store.listMany(["user:", "seen:", "activity:", "keys:"]),
    store.getMany([SETTINGS_KEY, SCHEDULE_KEY, LOGINS_KEY, ADMIN_LOG_KEY]),
    store.stamps("scan:"),
    store.status(),
  ]);

  const under = (prefix: string) => accounts.filter((d) => d.key.startsWith(prefix));
  const one = <T,>(key: string) => singles.find((d) => d.key === key)?.value as T | undefined;
  const users = usersFrom(under("user:"));
  const keyed = savedIntegrationsFrom(under("keys:"));
  const seen = new Map(under("seen:").map((d) => [d.key.slice("seen:".length), (d.value as { at: string }).at]));
  const activity = new Map(under("activity:").map((d) => [d.key.slice("activity:".length), d.value as Activity]));
  const logins = one<LoginEntry[]>(LOGINS_KEY) ?? [];
  const log = one<AdminEntry[]>(ADMIN_LOG_KEY) ?? [];
  const platform = platformFrom(one<Partial<PlatformSettings>>(SETTINGS_KEY));
  const schedule = scheduleFrom(one<Partial<Schedule>>(SCHEDULE_KEY));

  const people: PersonRow[] = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      picture: u.picture,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      lastSeenAt: seen.get(u.id) ?? null,
      loginCount: u.loginCount ?? null,
      niches: u.prefs.niches.map(nicheLabel),
      role: u.prefs.role ?? null,
      keys: (keyed.get(u.id) ?? []).map((id) => INTEGRATION_BY_ID.get(id)?.name ?? id),
      activity: activity.get(u.id) ?? {},
      suspended: u.suspended ?? null,
      admin: isAdmin(u),
      serverKeys: usesServerKeys(u),
    }))
    .sort((a, b) => (b.lastSeenAt ?? b.lastLoginAt).localeCompare(a.lastSeenAt ?? a.lastLoginAt));

  const now = Date.now();
  const lastActive = (p: PersonRow) => Date.parse(p.lastSeenAt ?? p.lastLoginAt);
  // Only the niches' own scans, not the cross-internet signals stored beside them.
  const nicheScans = scans.filter((s) => /^scan:[a-z0-9-]+$/.test(s.key));
  const scanTimes = nicheScans.map((s) => Date.parse(s.updatedAt)).filter(Number.isFinite);

  return {
    people,
    logins,
    log,
    platform,
    schedule: { value: schedule, next: nextRun(schedule) },
    storage,
    totals: {
      people: people.length,
      activeToday: people.filter((p) => now - lastActive(p) < DAY).length,
      activeWeek: people.filter((p) => now - lastActive(p) < 7 * DAY).length,
      newWeek: people.filter((p) => now - Date.parse(p.createdAt) < 7 * DAY).length,
      onboarded: people.filter((p) => p.username).length,
      withKeys: people.filter((p) => p.keys.length > 0).length,
      suspended: people.filter((p) => p.suspended).length,
      loginsToday: logins.filter((l) => now - Date.parse(l.at) < DAY).length,
      searches: people.reduce((n, p) => n + (p.activity.searches ?? 0), 0),
      chats: people.reduce((n, p) => n + (p.activity.chats ?? 0), 0),
    },
    data: {
      niches: nicheScans.length,
      oldestScan: scanTimes.length ? new Date(Math.min(...scanTimes)).toISOString() : null,
      newestScan: scanTimes.length ? new Date(Math.max(...scanTimes)).toISOString() : null,
    },
  };
}

export type AdminData = Awaited<ReturnType<typeof loadAdminData>>;

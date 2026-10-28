import { isAdmin, listUsers, savedIntegrationsByUser, usesServerKeys } from "@/lib/auth/users";
import { INTEGRATION_BY_ID } from "@/lib/keys-catalog";
import { nicheLabel } from "@/lib/niches";
import { adminLog, getPlatform, recentLogins, type Activity } from "@/lib/platform";
import { loadSummaries } from "@/lib/pulse/scan";
import { getSchedule, nextRun } from "@/lib/schedule";
import { store } from "@/lib/store";

/**
 * Everything the service dashboard shows, read in a handful of list queries
 * rather than one per person. Server only: it reads every account.
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
  const [users, keyed, seenDocs, activityDocs, logins, log, platform, schedule, pulse, storage] = await Promise.all([
    listUsers(),
    savedIntegrationsByUser(),
    store.list<{ at: string }>("seen:"),
    store.list<Activity>("activity:"),
    recentLogins(),
    adminLog(),
    getPlatform(),
    getSchedule(),
    loadSummaries().catch(() => null),
    store.status(),
  ]);

  const seen = new Map(seenDocs.map((d) => [d.key.slice("seen:".length), d.value.at]));
  const activity = new Map(activityDocs.map((d) => [d.key.slice("activity:".length), d.value]));

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
  const scans = pulse?.scans ?? [];
  const scanTimes = scans.map((s) => Date.parse(s.scannedAt)).filter(Number.isFinite);

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
      niches: scans.length,
      topics: scans.reduce((n, s) => n + s.topics.length, 0),
      oldestScan: scanTimes.length ? new Date(Math.min(...scanTimes)).toISOString() : null,
      newestScan: scanTimes.length ? new Date(Math.max(...scanTimes)).toISOString() : null,
    },
  };
}

export type AdminData = Awaited<ReturnType<typeof loadAdminData>>;

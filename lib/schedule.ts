import { store } from "@/lib/store";

/**
 * When the daily automatic scan runs, set from Settings. A GitHub Actions
 * workflow wakes every hour and asks claimDue(); the first wake at or after
 * the chosen hour (IST) on a day it has not yet run gets "yes". GitHub's
 * scheduler can start late or skip a beat, so "at or after" rather than
 * "exactly at", a late wake still runs that day's scan, once.
 */

export interface Schedule {
  enabled: boolean;
  /** Hour of the day in India time, 0–23. */
  hour: number;
  /** IST date (YYYY-MM-DD) of the last automatic scan, so a day runs once. */
  lastRun: string | null;
  lastRunAt: string | null;
}

const KEY = "settings:schedule";
const DEFAULT: Schedule = { enabled: true, hour: 9, lastRun: null, lastRunAt: null };
const IST_MS = 5.5 * 3_600_000;

/** The hour and date in India right now. */
export function istNow(at = Date.now()) {
  const d = new Date(at + IST_MS);
  return { hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
}

export async function getSchedule(): Promise<Schedule> {
  const doc = await store.get<Partial<Schedule>>(KEY).catch(() => null);
  return { ...DEFAULT, ...(doc?.value ?? {}) };
}

export async function saveSchedule(patch: { enabled?: boolean; hour?: number }): Promise<Schedule> {
  const current = await getSchedule();
  const hour = patch.hour === undefined ? current.hour : Math.round(patch.hour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("Hour must be 0–23.");
  const next = { ...current, hour, enabled: patch.enabled ?? current.enabled };
  await store.set(KEY, next);
  return next;
}

/** Is the scan due now? If so, mark today as run, so only one wake gets "yes". */
export async function claimDue(at = Date.now()): Promise<{ due: boolean; reason: string }> {
  const s = await getSchedule();
  const now = istNow(at);
  if (!s.enabled) return { due: false, reason: "Automatic scans are turned off in Settings." };
  if (s.lastRun === now.date) return { due: false, reason: `Already ran today (${s.lastRunAt ?? s.lastRun}).` };
  if (now.hour < s.hour) return { due: false, reason: `Scheduled for ${s.hour}:00 IST; it is ${now.hour}:xx.` };
  await store.set(KEY, { ...s, lastRun: now.date, lastRunAt: new Date(at).toISOString() });
  return { due: true, reason: `Running the ${s.hour}:00 IST scan.` };
}

/** When the next automatic scan will start, for Settings. */
export function nextRun(s: Schedule, at = Date.now()): string {
  const now = istNow(at);
  const today = s.lastRun !== now.date && now.hour < s.hour;
  const ranToday = s.lastRun === now.date;
  const label = `${((s.hour + 11) % 12) + 1}:00 ${s.hour < 12 ? "AM" : "PM"} IST`;
  if (!s.enabled) return "Off";
  if (today) return `today at ${label}`;
  if (!ranToday) return `next hourly check (today's ${label} scan is pending)`;
  return `tomorrow at ${label}`;
}

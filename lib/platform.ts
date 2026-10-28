import { after } from "next/server";
import { store } from "@/lib/store";

/**
 * Platform-wide switches the admin changes from the service dashboard, and the
 * small records the dashboard reads: who signed in, who was active, and what
 * the admin changed. All documents in the same store as everything else:
 *
 *   platform:settings   the switches below
 *   seen:<uid>          when that person last loaded a page
 *   activity:<uid>      how many searches, chats and scans they have run
 *   audit:logins        the most recent sign-ins, newest first
 *   audit:admin         every change made from the dashboard, newest first
 *
 * Sign-ins keep the country and city Vercel reports, never the IP address.
 */

export type AnnouncementTone = "info" | "warning";

export interface PlatformSettings {
  /** New Google accounts may sign up. Existing accounts sign in either way. */
  signupsOpen: boolean;
  /** Signed-in users may refresh scans with their own keys. The daily scan runs regardless. */
  userScans: boolean;
  /** A line shown at the top of every screen, or null for none. */
  announcement: { text: string; tone: AnnouncementTone; at: string } | null;
}

export const DEFAULT_PLATFORM: PlatformSettings = { signupsOpen: true, userScans: true, announcement: null };

export const SETTINGS_KEY = "platform:settings";
export const LOGINS_KEY = "audit:logins";
export const ADMIN_LOG_KEY = "audit:admin";

/** The switches from their stored document, defaults filled in. */
export const platformFrom = (value: Partial<PlatformSettings> | null | undefined): PlatformSettings => ({ ...DEFAULT_PLATFORM, ...value });
/** Each server instance re-reads the switches this often, so a change reaches every visitor within it. */
const SETTINGS_TTL_MS = 30_000;
let settingsCache: { at: number; value: PlatformSettings } | null = null;

export async function getPlatform(): Promise<PlatformSettings> {
  if (settingsCache && Date.now() - settingsCache.at < SETTINGS_TTL_MS) return settingsCache.value;
  const doc = await store.get<Partial<PlatformSettings>>(SETTINGS_KEY).catch(() => null);
  const value = platformFrom(doc?.value);
  settingsCache = { at: Date.now(), value };
  return value;
}

export async function savePlatform(next: PlatformSettings): Promise<PlatformSettings> {
  await store.set(SETTINGS_KEY, next);
  settingsCache = { at: Date.now(), value: next };
  return next;
}

/* ───────────── activity ───────────── */

export type ActivityKind = "searches" | "chats" | "scans" | "insights" | "discussions";
export type Activity = Partial<Record<ActivityKind, number>> & { lastAt?: string };

/** Last-seen is written at most this often per person per instance, so browsing costs no writes. */
const SEEN_EVERY_MS = 10 * 60_000;
const seenAt = new Map<string, number>();

/*
  Both run in after(): once the response has gone, so they cost the visitor
  nothing, and still inside the request, so a serverless function is not
  frozen with the write half done. Call them only while handling a request.
*/

/** Note that someone loaded a page. Never throws, never waits. */
export function touchSeen(uid: string): void {
  const last = seenAt.get(uid) ?? 0;
  if (Date.now() - last < SEEN_EVERY_MS) return;
  seenAt.set(uid, Date.now());
  after(() => store.set(`seen:${uid}`, { at: new Date().toISOString() }).catch(() => {}));
}

/** Count one search, chat or scan against someone. Never throws, never waits. */
export function track(uid: string, kind: ActivityKind): void {
  after(async () => {
    const key = `activity:${uid}`;
    const now = (await store.get<Activity>(key).catch(() => null))?.value ?? {};
    await store.set(key, { ...now, [kind]: (now[kind] ?? 0) + 1, lastAt: new Date().toISOString() }).catch(() => {});
  });
}

/* ───────────── audit trails ───────────── */

const LOG_LENGTH = 300;

export interface LoginEntry {
  uid: string;
  email: string;
  name: string;
  at: string;
  /** First sign-in, which created the account. */
  created: boolean;
  country: string | null;
  city: string | null;
  /** "Chrome on macOS", from the user agent. */
  device: string | null;
}

export interface AdminEntry {
  at: string;
  action: string;
  /** Who or what it was done to: an email, or "platform". */
  target: string;
  detail?: string;
}

async function prepend<T>(key: string, entry: T): Promise<void> {
  const list = (await store.get<T[]>(key))?.value ?? [];
  await store.set(key, [entry, ...list].slice(0, LOG_LENGTH));
}

export async function recordLogin(entry: LoginEntry): Promise<void> {
  await prepend(LOGINS_KEY, entry).catch(() => {});
}

export async function recordAdmin(entry: Omit<AdminEntry, "at">): Promise<void> {
  await prepend<AdminEntry>(ADMIN_LOG_KEY, { ...entry, at: new Date().toISOString() });
}

export async function recentLogins(): Promise<LoginEntry[]> {
  return (await store.get<LoginEntry[]>(LOGINS_KEY))?.value ?? [];
}

export async function adminLog(): Promise<AdminEntry[]> {
  return (await store.get<AdminEntry[]>(ADMIN_LOG_KEY))?.value ?? [];
}

/** "Chrome on macOS" from a user agent, or null. Coarse on purpose. */
export function deviceOf(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "another system";
  return `${browser} on ${os}`;
}

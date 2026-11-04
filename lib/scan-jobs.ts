import { backgroundModel } from "@/lib/ai/models";
import { getUser, isAdmin, keysFor, type User } from "@/lib/auth/users";
import { sign, unsign } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { runWithKeys } from "@/lib/keys";
import { NICHE_BY_ID, nicheLabel } from "@/lib/niches";
import { getPlatform } from "@/lib/platform";
import { scanKey, scanNiche, scanSignals, SIGNALS_KEY } from "@/lib/pulse/scan";
import { store } from "@/lib/store";

/**
 * Scans that run on the server, so they finish even if you leave the page
 * or close the tab.
 *
 * One niche fits in a serverless request; twenty don't. So a scan is a job,
 * kept in the store (scanjob:<uid>), worked one item per request: each step
 * scans one niche, records it, then starts the next step itself. The chain is
 * authorised by a signed, short-lived token naming the job and its owner,
 * and every step runs with that owner's keys, as a scan started from the
 * page always has. The page only reads the job to show progress.
 */

export interface JobItem { id: string; label: string }
export interface JobResult extends JobItem { ok: boolean; detail: string }

export interface ScanJob {
  id: string;
  uid: string;
  items: JobItem[];
  results: JobResult[];
  status: "running" | "done";
  startedAt: string;
  updatedAt: string;
  /** This site's address, for starting each next step. */
  origin: string;
}

const jobKey = (uid: string) => `scanjob:${uid}`;
/** A step that hasn't reported back in this long has died (a crash or a time limit): the job can be resumed. */
export const STALL_MS = 6 * 60_000;

export const isStalled = (j: ScanJob) => j.status === "running" && Date.now() - Date.parse(j.updatedAt) > STALL_MS;

export async function getJob(uid: string): Promise<ScanJob | null> {
  return (await store.get<ScanJob>(jobKey(uid)).catch(() => null))?.value ?? null;
}

/** Can this person start a scan right now? An error to show them, or null. */
export async function scanBlocked(user: User): Promise<{ error: string; needsKey?: boolean } | null> {
  if (!isAdmin(user) && !(await getPlatform()).userScans) {
    return { error: "Scans refresh automatically once a day right now, so there's nothing to run." };
  }
  const keys = await keysFor(user);
  if (!runWithKeys(keys, () => backgroundModel())) return { error: "Add a free Gemini or Groq key in Keys to run scans.", needsKey: true };
  return null;
}

/**
 * Start a scan of these niches (and the cross-internet signals), or carry on
 * with the one already running. A stalled job picks up where it stopped.
 */
export async function startJob(user: User, niches: string[], signals: boolean, origin: string): Promise<ScanJob> {
  const current = await getJob(user.id);
  if (current?.status === "running" && !isStalled(current)) return current;
  if (current && isStalled(current)) {
    const resumed = { ...current, origin, updatedAt: new Date().toISOString() };
    await store.set(jobKey(user.id), resumed);
    await kick(resumed);
    return resumed;
  }
  const items: JobItem[] = [
    ...(signals ? [{ id: "signals", label: "Spiking searches & pages" }] : []),
    ...niches.filter((n) => NICHE_BY_ID.has(n)).map((n) => ({ id: n, label: nicheLabel(n) })),
  ];
  const now = new Date().toISOString();
  const job: ScanJob = { id: crypto.randomUUID(), uid: user.id, items, results: [], status: items.length ? "running" : "done", startedAt: now, updatedAt: now, origin };
  await store.set(jobKey(user.id), job);
  if (items.length) await kick(job);
  return job;
}

/** Start the job's next step: a request to this same site, answered at once, worked in the background. */
async function kick(job: ScanJob): Promise<void> {
  const token = sign({ jid: job.id, uid: job.uid, exp: Date.now() + 2 * 60 * 60_000 });
  await fetch(`${job.origin}/api/scan/step`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    // If the next step couldn't be started, the job stalls and the page offers to resume it.
  });
}

/** Who a step is for, from its token: null when it's forged or expired. */
export function readStepToken(header: string | null): { jid: string; uid: string } | null {
  const t = unsign<{ jid: string; uid: string; exp: number }>(header?.replace(/^Bearer /, ""));
  return t && t.exp > Date.now() ? { jid: t.jid, uid: t.uid } : null;
}

/** Scan one item, as the cooldown allows. Shared by the job steps and the scheduler's /api/scan. */
export async function scanItem(id: string, opts: { ignoreCooldown: boolean }): Promise<{ ok: boolean; detail: string; skipped?: boolean }> {
  const key = id === "signals" ? SIGNALS_KEY : scanKey(id);
  if (!opts.ignoreCooldown) {
    const last = await store.get(key);
    const age = last ? Date.now() - Date.parse(last.updatedAt) : Infinity;
    if (age < config.scan.cooldownMs) return { ok: true, skipped: true, detail: "already fresh" };
  }
  if (id === "signals") {
    const s = await scanSignals();
    return { ok: true, detail: `${s.signals.length} signals` };
  }
  const s = await scanNiche(id);
  return { ok: true, detail: `${s.topics.length} topics` };
}

/** One step: scan the job's next item with its owner's keys, record it, and start the step after. */
export async function runStep(jid: string, uid: string): Promise<void> {
  const job = await getJob(uid);
  if (!job || job.id !== jid || job.status !== "running") return;
  const item = job.items[job.results.length];
  if (!item) {
    await store.set(jobKey(uid), { ...job, status: "done", updatedAt: new Date().toISOString() });
    return;
  }
  const user = await getUser(uid);
  let result: JobResult;
  if (!user || user.suspended) {
    result = { ...item, ok: false, detail: "account not available" };
  } else {
    const blocked = await scanBlocked(user);
    if (blocked) {
      // Same answer for every item that follows: end the job here.
      const results = [...job.results, { ...item, ok: false, detail: blocked.error }];
      await store.set(jobKey(uid), { ...job, results, status: "done", updatedAt: new Date().toISOString() });
      return;
    }
    try {
      const r = await runWithKeys(await keysFor(user), () => scanItem(item.id, { ignoreCooldown: false }));
      result = { ...item, ok: r.ok, detail: r.detail };
    } catch (e) {
      result = { ...item, ok: false, detail: (e as Error).message.slice(0, 160) };
    }
  }
  // Re-read in case the job was replaced while this item scanned.
  const latest = await getJob(uid);
  if (!latest || latest.id !== jid) return;
  const results = [...latest.results, result];
  const next: ScanJob = { ...latest, results, status: results.length >= latest.items.length ? "done" : "running", updatedAt: new Date().toISOString() };
  await store.set(jobKey(uid), next);
  if (next.status === "running") await kick(next);
}

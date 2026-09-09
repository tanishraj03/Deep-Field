import fs from "node:fs/promises";
import path from "node:path";
import type { DailyBrief, IntelligenceItem, SyncRun } from "@/lib/types";
import type { AppSettings, Repository, SeenRecord, UsageRecord } from "./types";
import { rejectFabricated } from "./guard";
import { config } from "@/lib/config";

interface Store {
  seen: Record<string, SeenRecord>;
  items: IntelligenceItem[];
  briefs: DailyBrief[];
  runs: SyncRun[];
  usage: Record<string, { requests: number; tokens: number }>;
  saved: string[];
  settings?: Partial<AppSettings>;
}

const empty = (): Store => ({ seen: {}, items: [], briefs: [], runs: [], usage: {}, saved: [] });

/**
 * Zero-dependency store.
 *
 * The project root is read-only on Vercel, so writing there failed and every
 * request fell back to a fresh in-process object: collect stored 536 items and
 * the next request — the page render, or the analyse stage — got an empty
 * store and showed "No signal yet this morning".
 *
 * /tmp IS writable on Vercel and survives for the life of the container, which
 * is reused across requests for minutes at a time. Writing there makes the app
 * work through a normal morning without any account. It is still not shared
 * between containers, so it is honestly reported as non-durable and Supabase
 * remains the real answer — but the difference between this and nothing is the
 * difference between a working screen and an empty one.
 */
const STORE_FILE = process.env.VERCEL
  ? "/tmp/deep-field/store.json"
  : path.join(process.cwd(), ".data", "store.json");

export class MemoryRepository implements Repository {
  readonly id = "local-file";
  private store: Store = empty();
  private file = STORE_FILE;
  private loaded = false;
  private writable = true;
  /** Set once a write has actually succeeded — not merely been attempted. */
  private proven = false;

  /**
   * Durable across restarts, not just across requests. On serverless /tmp is
   * container-scoped, so this is false there even when writes succeed: the
   * previous version reported `true` before it had ever tried to write, which
   * told Settings the data was safe when it was not.
   */
  get persistent() { return this.writable && this.proven && !process.env.VERCEL; }
  async healthy() { return true; }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this.store = { ...empty(), ...(JSON.parse(raw) as Store) };
    } catch { /* first run, or read-only fs */ }
  }

  private async flush() {
    if (!this.writable) return;
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(this.file, JSON.stringify(this.store), "utf8");
      this.proven = true;
    } catch {
      this.writable = false; // genuinely read-only — stay in memory
    }
  }

  async getSeen() { await this.load(); return this.store.seen; }
  async putSeen(records: SeenRecord[]) {
    await this.load();
    for (const r of records) this.store.seen[r.id] = r;
    await this.flush();
  }

  async saveItems(items: IntelligenceItem[]) {
    await this.load();
    const byId = new Map(rejectFabricated(this.store.items).map((i) => [i.id, i]));
    for (const i of rejectFabricated(items)) byId.set(i.id, i);
    this.store.items = [...byId.values()]
      .sort((a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt))
      .slice(0, 600);
    await this.flush();
  }
  // Filtered on read as well as write: a store poisoned by an earlier build
  // heals itself on the next request instead of needing a manual purge.
  async listItems(limit = 400) {
    await this.load();
    return rejectFabricated(this.store.items).slice(0, limit);
  }

  async saveBrief(brief: DailyBrief) {
    await this.load();
    this.store.briefs = [brief, ...this.store.briefs.filter((b) => b.date !== brief.date)].slice(0, 30);
    await this.flush();
  }
  async latestBrief() { await this.load(); return this.store.briefs[0] ?? null; }

  async saveRun(run: SyncRun) {
    await this.load();
    this.store.runs = [run, ...this.store.runs].slice(0, 30);
    await this.flush();
  }
  async latestRun() { await this.load(); return this.store.runs[0] ?? null; }

  async getUsage(day: string, month: string): Promise<UsageRecord> {
    await this.load();
    const d = this.store.usage[day] ?? { requests: 0, tokens: 0 };
    const m = Object.entries(this.store.usage)
      .filter(([k]) => k.startsWith(month))
      .reduce((a, [, v]) => a + v.requests, 0);
    return { requestsToday: d.requests, requestsThisMonth: m, estimatedTokensToday: d.tokens };
  }
  async incrementUsage(day: string, _month: string, tokens: number) {
    await this.load();
    const cur = this.store.usage[day] ?? { requests: 0, tokens: 0 };
    this.store.usage[day] = { requests: cur.requests + 1, tokens: cur.tokens + tokens };
    await this.flush();
  }

  async getSaved() { await this.load(); return this.store.saved; }
  async toggleSaved(id: string) {
    await this.load();
    this.store.saved = this.store.saved.includes(id)
      ? this.store.saved.filter((s) => s !== id)
      : [...this.store.saved, id];
    await this.flush();
    return this.store.saved;
  }

  async getSettings(): Promise<AppSettings> {
    await this.load();
    return { briefHourIst: this.store.settings?.briefHourIst ?? config.briefHourIst };
  }
  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    await this.load();
    this.store.settings = { ...this.store.settings, ...patch };
    await this.flush();
    return this.getSettings();
  }

}

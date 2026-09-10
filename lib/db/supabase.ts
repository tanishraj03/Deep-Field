import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type { DailyBrief, IntelligenceItem, SyncRun } from "@/lib/types";
import type { AppSettings, Repository, SeenRecord, UsageRecord } from "./types";
import { rejectFabricated } from "./guard";

/**
 * Postgres refuses an upsert that touches the same primary key twice in one
 * statement: "ON CONFLICT DO UPDATE command cannot affect row a second time"
 * (SQLSTATE 21000). Clusters can legitimately produce a repeated id within a
 * single run, and one repeat failed the WHOLE batch — seen_events stayed empty
 * and day-over-day novelty never worked. Last write per id wins, as the
 * database would have done anyway.
 */
function byId<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}

/**
 * The Supabase client returns errors, it does not throw them. Every write in
 * this file used to discard that value, so a rejected batch looked exactly
 * like a successful one. Anything that fails now says so.
 */
function assertOk(op: string, error: { message?: string; code?: string } | null): void {
  if (!error) return;
  throw new Error(`Supabase ${op} failed${error.code ? ` (${error.code})` : ""}: ${error.message ?? "unknown error"}`);
}

/**
 * Supabase free tier. Service-role key is read from a server-only env var and
 * never reaches the browser — every call in this file runs in a route handler
 * or a server component.
 */
export class SupabaseRepository implements Repository {
  readonly id = "supabase";
  readonly persistent = true;
  private db: SupabaseClient;

  constructor() {
    this.db = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async healthy(): Promise<boolean> {
    const { error } = await this.db.from("settings").select("key").limit(1);
    return !error;
  }

  async getSeen(): Promise<Record<string, SeenRecord>> {
    const { data } = await this.db.from("seen_events")
      .select("id, first_seen_at, source_count, mentions").limit(5000);
    const out: Record<string, SeenRecord> = {};
    for (const r of data ?? []) {
      out[r.id] = { id: r.id, firstSeenAt: r.first_seen_at, sourceCount: r.source_count, mentions: r.mentions };
    }
    return out;
  }

  async putSeen(records: SeenRecord[]) {
    const rows = byId(records);
    if (!rows.length) return;
    const { error } = await this.db.from("seen_events").upsert(
      rows.map((r) => ({
        id: r.id, first_seen_at: r.firstSeenAt, source_count: r.sourceCount,
        mentions: r.mentions, last_updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
    assertOk("putSeen", error);
  }

  async saveItems(items: IntelligenceItem[]) {
    items = byId(rejectFabricated(items));
    if (!items.length) return;
    const { error } = await this.db.from("intelligence_items").upsert(
      items.map((i) => ({
        id: i.id, type: i.type, title: i.title, payload: i,
        published_at: i.publishedAt, first_seen_at: i.firstSeenAt,
        last_updated_at: i.lastUpdatedAt, region: i.region,
        opportunity_score: i.opportunityScore ?? null, trend_score: i.trendScore ?? null,
      })),
      { onConflict: "id" },
    );
    assertOk("saveItems", error);
  }

  async listItems(limit = 400): Promise<IntelligenceItem[]> {
    const { data } = await this.db.from("intelligence_items")
      .select("payload").order("last_updated_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => r.payload as IntelligenceItem);
  }

  async saveBrief(brief: DailyBrief) {
    const { error } = await this.db.from("daily_briefs").upsert(
      { id: brief.id, date: brief.date, payload: brief, generated_at: brief.generatedAt },
      { onConflict: "date" },
    );
    assertOk("saveBrief", error);
  }

  async latestBrief(): Promise<DailyBrief | null> {
    const { data } = await this.db.from("daily_briefs")
      .select("payload").order("date", { ascending: false }).limit(1).maybeSingle();
    return (data?.payload as DailyBrief) ?? null;
  }

  async saveRun(run: SyncRun) {
    const { error } = await this.db.from("sync_runs").insert({
      id: run.id, started_at: run.startedAt, finished_at: run.finishedAt, payload: run,
    });
    assertOk("saveRun", error);
  }

  async latestRun(): Promise<SyncRun | null> {
    const { data } = await this.db.from("sync_runs")
      .select("payload").order("started_at", { ascending: false }).limit(1).maybeSingle();
    return (data?.payload as SyncRun) ?? null;
  }

  async getUsage(day: string, month: string): Promise<UsageRecord> {
    const { data } = await this.db.from("ai_usage")
      .select("day, requests, tokens").like("day", `${month}%`);
    const rows = data ?? [];
    const today = rows.find((r) => r.day === day);
    return {
      requestsToday: today?.requests ?? 0,
      requestsThisMonth: rows.reduce((a, r) => a + (r.requests ?? 0), 0),
      estimatedTokensToday: today?.tokens ?? 0,
    };
  }

  async incrementUsage(day: string, _month: string, tokens: number) {
    // Atomic increment via a Postgres function so parallel calls cannot undercount.
    const { error } = await this.db.rpc("bump_ai_usage", { p_day: day, p_tokens: tokens });
    if (error) {
      const cur = await this.getUsage(day, day.slice(0, 7));
      const { error } = await this.db.from("ai_usage").upsert(
        { day, requests: cur.requestsToday + 1, tokens: cur.estimatedTokensToday + tokens },
        { onConflict: "day" },
      );
      // Usage accounting must never take down a run, but a silent failure here
      // would mean the quota valve is guarding a number that stopped moving.
      if (error) console.error(`Supabase incrementUsage failed: ${error.message}`);
    }
  }

  async getSaved(): Promise<string[]> {
    const { data } = await this.db.from("saved_items").select("item_id");
    return (data ?? []).map((r) => r.item_id as string);
  }

  async toggleSaved(id: string): Promise<string[]> {
    const current = await this.getSaved();
    if (current.includes(id)) await this.db.from("saved_items").delete().eq("item_id", id);
    else await this.db.from("saved_items").insert({ item_id: id });
    return this.getSaved();
  }

  /**
   * Settings live in one row keyed "app". The table is created by
   * supabase/schema.sql; if it is missing we fall back to the env default
   * rather than failing a run over a preference.
   */
  async getSettings(): Promise<AppSettings> {
    const { data } = await this.db.from("app_settings").select("value").eq("key", "app").maybeSingle();
    const v = (data?.value ?? {}) as Partial<AppSettings>;
    return { briefHourIst: v.briefHourIst ?? config.briefHourIst };
  }
  async saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const merged = { ...(await this.getSettings()), ...patch };
    await this.db.from("app_settings").upsert({ key: "app", value: merged }, { onConflict: "key" });
    return merged;
  }

}

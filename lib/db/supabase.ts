import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type { DailyBrief, IntelligenceItem, SyncRun } from "@/lib/types";
import type { AppSettings, Repository, SeenRecord, UsageRecord } from "./types";
import { rejectFabricated } from "./guard";

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
    if (!records.length) return;
    await this.db.from("seen_events").upsert(
      records.map((r) => ({
        id: r.id, first_seen_at: r.firstSeenAt, source_count: r.sourceCount,
        mentions: r.mentions, last_updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
  }

  async saveItems(items: IntelligenceItem[]) {
    items = rejectFabricated(items);
    if (!items.length) return;
    if (!items.length) return;
    await this.db.from("intelligence_items").upsert(
      items.map((i) => ({
        id: i.id, type: i.type, title: i.title, payload: i,
        published_at: i.publishedAt, first_seen_at: i.firstSeenAt,
        last_updated_at: i.lastUpdatedAt, region: i.region,
        opportunity_score: i.opportunityScore ?? null, trend_score: i.trendScore ?? null,
      })),
      { onConflict: "id" },
    );
  }

  async listItems(limit = 400): Promise<IntelligenceItem[]> {
    const { data } = await this.db.from("intelligence_items")
      .select("payload").order("last_updated_at", { ascending: false }).limit(limit);
    return (data ?? []).map((r) => r.payload as IntelligenceItem);
  }

  async saveBrief(brief: DailyBrief) {
    await this.db.from("daily_briefs").upsert(
      { id: brief.id, date: brief.date, payload: brief, generated_at: brief.generatedAt },
      { onConflict: "date" },
    );
  }

  async latestBrief(): Promise<DailyBrief | null> {
    const { data } = await this.db.from("daily_briefs")
      .select("payload").order("date", { ascending: false }).limit(1).maybeSingle();
    return (data?.payload as DailyBrief) ?? null;
  }

  async saveRun(run: SyncRun) {
    await this.db.from("sync_runs").insert({
      id: run.id, started_at: run.startedAt, finished_at: run.finishedAt, payload: run,
    });
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
      await this.db.from("ai_usage").upsert(
        { day, requests: cur.requestsToday + 1, tokens: cur.estimatedTokensToday + tokens },
        { onConflict: "day" },
      );
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

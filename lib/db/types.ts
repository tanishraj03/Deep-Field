import type { DailyBrief, IntelligenceItem, SyncRun } from "@/lib/types";

/** Settings an operator can change from the interface, not just from env. */
export interface AppSettings {
  /** Hour of day, IST, at which the brief is delivered to Slack. 0-23. */
  briefHourIst: number;
}

export interface SeenRecord { id: string; firstSeenAt: string; sourceCount: number; mentions: number }

export interface UsageRecord {
  requestsToday: number;
  requestsThisMonth: number;
  estimatedTokensToday: number;
}

/**
 * The only storage contract. Swapping Supabase for anything else means
 * implementing this interface — no pipeline code changes.
 */
export interface Repository {
  readonly id: string;
  readonly persistent: boolean;
  healthy(): Promise<boolean>;

  getSeen(): Promise<Record<string, SeenRecord>>;
  putSeen(records: SeenRecord[]): Promise<void>;

  saveItems(items: IntelligenceItem[]): Promise<void>;
  listItems(limit?: number): Promise<IntelligenceItem[]>;

  saveBrief(brief: DailyBrief): Promise<void>;
  latestBrief(): Promise<DailyBrief | null>;

  saveRun(run: SyncRun): Promise<void>;
  latestRun(): Promise<SyncRun | null>;

  getUsage(day: string, month: string): Promise<UsageRecord>;
  incrementUsage(day: string, month: string, tokens: number): Promise<void>;

  getSaved(): Promise<string[]>;
  toggleSaved(id: string): Promise<string[]>;

  /** Operator-changeable settings. Falls back to env defaults when unset. */
  getSettings(): Promise<AppSettings>;
  saveSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
}

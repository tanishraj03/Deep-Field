import type { SyncRun, UsageStat } from "@/lib/types";

/** Type-only contract shared by the server status builder and the settings UI. */
export interface SystemStatus {
  mode: "live" | "mock";
  freeOnly: boolean;
  blocked: { service: string; reason: string }[];
  ai: UsageStat & { provider: string };
  database: { backend: string; persistent: boolean; note: string };
  slack: { connected: boolean; channel: string; note: string };
  cron: { configured: boolean; note: string };
  lastRun: SyncRun | null;
}

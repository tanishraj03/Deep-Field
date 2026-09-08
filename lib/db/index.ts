import { config } from "@/lib/config";
import { MemoryRepository } from "./memory";
import type { Repository } from "./types";

export type { Repository, SeenRecord, UsageRecord } from "./types";

let instance: Repository | null = null;
let status: { backend: string; persistent: boolean; note: string } = {
  backend: "local-file", persistent: true, note: "Local file store",
};

export async function getRepository(): Promise<Repository> {
  if (instance) return instance;

  if (config.supabase.url && config.supabase.serviceKey) {
    // Loaded lazily so the Supabase client is never bundled when unused.
    const { SupabaseRepository } = await import("./supabase");
    const repo = new SupabaseRepository();
    if (await repo.healthy()) {
      instance = repo;
      status = { backend: "supabase", persistent: true, note: "Supabase free tier" };
      return instance;
    }
    status = {
      backend: "local-file", persistent: false,
      note: "Supabase configured but unreachable — using local store. Check the schema has been applied.",
    };
  } else {
    status = {
      backend: "local-file", persistent: true,
      note: "No Supabase keys set — using the bundled local store.",
    };
  }

  instance = new MemoryRepository();
  return instance;
}

export function repositoryStatus() { return status; }
export function resetRepository() { instance = null; }

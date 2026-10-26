import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * A key-value store, and nothing more.
 *
 * Everything the app keeps is a document: one scan per niche, one signals
 * scan, cached Explore results. With Supabase configured they live in the
 * `app_settings` table (key text, value jsonb) that already exists in every
 * Deep Field database — no migration needed. Without it they live in a local
 * JSON file, or /tmp on Vercel, where they last as long as the container.
 */

export interface StoredDoc<T> { key: string; value: T; updatedAt: string }

interface Backend {
  readonly id: "supabase" | "file";
  readonly durable: boolean;
  get<T>(key: string): Promise<StoredDoc<T> | null>;
  set<T>(key: string, value: T): Promise<void>;
  list<T>(prefix: string): Promise<StoredDoc<T>[]>;
  remove(key: string): Promise<void>;
}

const TABLE = "app_settings";

class SupabaseBackend implements Backend {
  readonly id = "supabase" as const;
  readonly durable = true;
  private db: SupabaseClient;
  constructor() {
    this.db = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async healthy() {
    const { error } = await this.db.from(TABLE).select("key").limit(1);
    return !error;
  }
  async get<T>(key: string) {
    const { data, error } = await this.db.from(TABLE).select("key, value, updated_at").eq("key", key).maybeSingle();
    if (error) throw new Error(`Store read failed: ${error.message}`);
    return data ? { key: data.key, value: data.value as T, updatedAt: data.updated_at } : null;
  }
  async set<T>(key: string, value: T) {
    const { error } = await this.db.from(TABLE)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(`Store write failed: ${error.message}`);
  }
  async list<T>(prefix: string) {
    const { data, error } = await this.db.from(TABLE)
      .select("key, value, updated_at").like("key", `${prefix}%`).limit(500);
    if (error) throw new Error(`Store list failed: ${error.message}`);
    return (data ?? []).map((r) => ({ key: r.key, value: r.value as T, updatedAt: r.updated_at }));
  }
  async remove(key: string) {
    await this.db.from(TABLE).delete().eq("key", key);
  }
}

const FILE = process.env.VERCEL
  ? "/tmp/deep-field/kv.json"
  : path.join(process.cwd(), ".data", "kv.json");

class FileBackend implements Backend {
  readonly id = "file" as const;
  readonly durable = !process.env.VERCEL;
  private cache: Record<string, { value: unknown; updatedAt: string }> | null = null;

  private async load() {
    if (this.cache) return this.cache;
    try { this.cache = JSON.parse(await fs.readFile(FILE, "utf8")); }
    catch { this.cache = {}; }
    return this.cache!;
  }
  private async flush() {
    try {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(this.cache));
    } catch (e) {
      console.error(`Local store write failed: ${(e as Error).message}`);
    }
  }
  async get<T>(key: string) {
    const all = await this.load();
    const hit = all[key];
    return hit ? { key, value: hit.value as T, updatedAt: hit.updatedAt } : null;
  }
  async set<T>(key: string, value: T) {
    const all = await this.load();
    all[key] = { value, updatedAt: new Date().toISOString() };
    await this.flush();
  }
  async list<T>(prefix: string) {
    const all = await this.load();
    return Object.entries(all)
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, v]) => ({ key, value: v.value as T, updatedAt: v.updatedAt }));
  }
  async remove(key: string) {
    const all = await this.load();
    delete all[key];
    await this.flush();
  }
}

let backend: Backend | null = null;
let note = "";

async function resolve(): Promise<Backend> {
  if (backend) return backend;
  if (config.supabase.url && config.supabase.serviceKey) {
    const sb = new SupabaseBackend();
    if (await sb.healthy().catch(() => false)) {
      backend = sb;
      note = "Supabase";
      return backend;
    }
    note = "Supabase is configured but unreachable — using a local file instead.";
  } else {
    note = process.env.VERCEL
      ? "No database configured: data lives in this server instance and resets when it recycles. Add Supabase to keep it."
      : "Local file store (.data/kv.json).";
  }
  backend = new FileBackend();
  return backend;
}

export const store = {
  async get<T>(key: string) { return (await resolve()).get<T>(key); },
  async set<T>(key: string, value: T) { return (await resolve()).set(key, value); },
  async list<T>(prefix: string) { return (await resolve()).list<T>(prefix); },
  async remove(key: string) { return (await resolve()).remove(key); },
  async status() {
    const b = await resolve();
    return { backend: b.id, durable: b.durable, note };
  },
};

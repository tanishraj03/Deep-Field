import { config } from "@/lib/config";
import { fetchWithTimeout } from "@/lib/utils";

export class SourceError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export interface GetOpts {
  headers?: Record<string, string>;
  /** Minimum gap between requests to the same host, in ms. */
  gapMs?: number;
  timeoutMs?: number;
}

export async function get(url: string, opts: GetOpts = {}): Promise<Response> {
  const res = await fetchWithTimeout(url, opts.timeoutMs ?? config.http.timeoutMs, {
    headers: { "User-Agent": config.http.userAgent, ...opts.headers },
    cache: "no-store",
    minDelayMs: opts.gapMs,
  });
  return res;
}

export async function getJson<T>(url: string, opts: GetOpts = {}): Promise<T> {
  const res = await get(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  if (res.status === 429) throw new SourceError("rate limited (429)", 429);
  if (!res.ok) throw new SourceError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as T;
}

export async function getText(url: string, opts: GetOpts = {}): Promise<string> {
  const res = await get(url, opts);
  if (res.status === 429) throw new SourceError("rate limited (429)", 429);
  if (!res.ok) throw new SourceError(`HTTP ${res.status}`, res.status);
  return res.text();
}

export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.name === "AbortError" ? "timed out" : e.message;
  return String(e);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

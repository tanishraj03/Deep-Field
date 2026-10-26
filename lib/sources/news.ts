import type { Post } from "@/lib/types";
import { get, SourceError } from "./http";

/**
 * GDELT DOC 2.0 — a free, keyless index of worldwide online news, updated
 * every 15 minutes, filterable by the publisher's country. It is the one
 * source here that can say how many articles discussed something, per day,
 * and how much of that coverage was Indian.
 *
 * GDELT asks for at most one request every five seconds; the host queue
 * enforces that. Errors come back as plain text with HTTP 200.
 */

const API = "https://api.gdeltproject.org/api/v2/doc/doc";
const GAP_MS = 5200;

function gdeltQuery(query: string, india: boolean): string {
  const q = query.trim().replace(/"/g, "");
  const phrase = /\s/.test(q) ? `"${q}"` : q;
  return india ? `${phrase} sourcecountry:IN` : phrase;
}

async function call<T>(params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, format: "json" });
  const res = await get(`${API}?${qs}`, { gapMs: GAP_MS, timeoutMs: 12_000 });
  if (res.status === 429) throw new SourceError("GDELT is rate limiting — news volume will return on the next search", 429);
  if (!res.ok) throw new SourceError(`GDELT HTTP ${res.status}`, res.status);
  const text = await res.text();
  try { return JSON.parse(text) as T; }
  catch { throw new SourceError(`GDELT: ${text.slice(0, 120).trim()}`); }
}

/** Articles per day over the last two weeks, oldest first. */
export async function volume(query: string, india: boolean): Promise<Map<string, number>> {
  const json = await call<{ timeline?: { data?: { date: string; value: number }[] }[] }>({
    query: gdeltQuery(query, india), mode: "timelinevolraw", timespan: "14d",
  });
  const out = new Map<string, number>();
  for (const d of json.timeline?.[0]?.data ?? []) {
    const day = `${d.date.slice(0, 4)}-${d.date.slice(4, 6)}-${d.date.slice(6, 8)}`;
    out.set(day, (out.get(day) ?? 0) + d.value);
  }
  return out;
}

export async function articles(query: string, india: boolean): Promise<Post[]> {
  const json = await call<{ articles?: { url: string; title: string; domain: string; seendate: string; sourcecountry: string }[] }>({
    query: gdeltQuery(query, india), mode: "artlist", maxrecords: "20", sort: "hybridrel", timespan: "7d",
  });
  return (json.articles ?? []).map((a) => {
    const d = a.seendate;
    const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:00Z`;
    return {
      id: `news:${a.url}`,
      source: "news" as const,
      title: a.title,
      url: a.url,
      community: a.domain,
      region: a.sourcecountry === "India" ? "IN" as const : "GLOBAL" as const,
      createdAt: Number.isFinite(Date.parse(iso)) ? iso : null,
      measured: false,
    };
  });
}

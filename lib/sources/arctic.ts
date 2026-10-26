import { config } from "@/lib/config";
import { get, SourceError, sleep } from "./http";

/**
 * Arctic Shift — a public, free archive of Reddit, kept current to within
 * minutes. It is how this app reads Reddit without a Reddit API key: Reddit's
 * own JSON answers 403 to anonymous clients, and its RSS rate-limits after a
 * handful of requests.
 *
 * Two facts about its numbers, both verified against Reddit directly:
 *  - post and comment counts are accurate once a post is ~36 hours old
 *    (a post it reported at 225 comments had 218 on Reddit's own feed);
 *  - before that they read 0 or 1, because the archive has not re-collected
 *    them yet. Those posts are marked unmeasured and count as volume only.
 *
 * The service asks for light use — a few requests a second — and signals load
 * with 429 plus X-RateLimit-Reset. We wait that out once, then give up.
 * https://github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md
 */

const BASE = "https://arctic-shift.photon-reddit.com/api";
// Parallelism is bounded by the caller (a pool of 3), not a per-host queue:
// a queue serialised every request and pushed a niche scan past the
// serverless time limit.
const GAP_MS = 0;

/** How long after posting the archive's counts can be trusted. */
export const MATURE_AFTER_MS = 36 * 60 * 60 * 1000;

export interface ArcticPost {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  created_utc: number;
  selftext?: string;
  over_18?: boolean;
  link_flair_text?: string | null;
}

async function call<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${BASE}${path}?${qs}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await get(url, { gapMs: GAP_MS, timeoutMs: config.http.timeoutMs + 8000 });
    if (res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? 5);
      if (attempt === 0 && reset <= 15) { await sleep(reset * 1000 + 200); continue; }
      throw new SourceError("Reddit archive is rate limiting — try again in a minute", 429);
    }
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
    // Under load the service answers 422 "Timeout. Maybe slow down a bit".
    // That is a "wait", so it gets the same single retry as a 429.
    if (res.status === 422 && /timeout/i.test(json.error ?? "") && attempt === 0) { await sleep(2500); continue; }
    if (!res.ok || json.error) throw new SourceError(`Reddit archive: ${json.error ?? `HTTP ${res.status}`}`, res.status);
    return json.data as T;
  }
  throw new SourceError("Reddit archive unavailable");
}

const POST_FIELDS = "id,title,subreddit,score,num_comments,created_utc,selftext,over_18,link_flair_text";

export function searchPosts(p: {
  subreddit?: string; query?: string; after?: string; before?: string; limit?: number;
}): Promise<ArcticPost[]> {
  // NSFW is filtered here rather than with over_18=false: combined with a
  // keyword query that parameter makes the archive time out.
  return call<ArcticPost[]>("/posts/search", {
    subreddit: p.subreddit, query: p.query, after: p.after, before: p.before,
    limit: p.limit ?? 100, fields: POST_FIELDS,
  }).then((d) => (d ?? []).filter((x) => !x.over_18));
}

export function postsById(ids: string[]): Promise<ArcticPost[]> {
  if (!ids.length) return Promise.resolve([]);
  return call<ArcticPost[]>("/posts/ids", { ids: ids.slice(0, 500).join(","), fields: POST_FIELDS })
    .then((d) => (d ?? []).filter((x) => !x.over_18));
}

export function threadComments(linkId: string, limit = 100) {
  return call<{ body: string; score: number; author: string }[]>("/comments/search", {
    link_id: linkId, limit, fields: "body,score,author",
  }).then((d) => d ?? []);
}

/** Posts per day for one community, oldest first. Empty for a dead community. */
export async function dailyPosts(sub: string, days = 14): Promise<{ date: string; value: number }[]> {
  const data = await call<{ date: number; value: number }[]>("/time_series", {
    key: `r/${sub}/posts/count`, precision: "day", after: `${days + 1}d`,
  });
  return (data ?? []).map((d) => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), value: d.value }));
}

export function isMeasured(createdUtcSeconds: number): boolean {
  return Date.now() - createdUtcSeconds * 1000 >= MATURE_AFTER_MS;
}

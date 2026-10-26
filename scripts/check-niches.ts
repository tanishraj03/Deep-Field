/**
 * Checks every subreddit in lib/niches.ts against live activity.
 * Run: npx tsx scripts/check-niches.ts
 * A community with no posts in the last week is reported so it can be swapped.
 */
import { NICHES } from "../lib/niches";

const A = "https://arctic-shift.photon-reddit.com/api";

async function weekly(sub: string): Promise<number | null> {
  const res = await fetch(`${A}/time_series?key=r/${sub}/posts/count&precision=day&after=8d`);
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: { value: number }[] };
  return (json.data ?? []).reduce((a, d) => a + d.value, 0);
}

(async () => {
  for (const n of NICHES) {
    for (const region of ["IN", "GLOBAL"] as const) {
      for (const sub of n.subreddits[region]) {
        const v = await weekly(sub);
        const flag = v === null ? "ERR " : v === 0 ? "DEAD" : v < 20 ? "LOW " : "ok  ";
        console.log(`${flag} ${n.id.padEnd(14)} ${region.padEnd(6)} r/${sub.padEnd(24)} ${v ?? "-"} posts/wk`);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
})();

/**
 * How the current scoring spreads over the stored scans: virality, heat and
 * verdict counts, and the top topics by each. Read-only.
 *
 *   npx tsx scripts/score-report.ts
 */
import "./load-env";
import { loadPulse } from "@/lib/pulse/scan";

async function main() {
const { scans } = await loadPulse();
const topics = scans.flatMap((s) => s.topics);
const calls = { make: 0, test: 0, skip: 0 };
for (const t of topics) calls[t.verdict.call]++;
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
const v = topics.map((t) => t.virality), h = topics.map((t) => t.heat);
console.log(`${topics.length} topics · verdicts`, calls);
console.log("virality p10/p50/p90", pct(v, 0.1), pct(v, 0.5), pct(v, 0.9), "· heat p10/p50/p90", pct(h, 0.1), pct(h, 0.5), pct(h, 0.9));
for (const t of [...topics].sort((a, b) => b.virality - a.virality).slice(0, 8)) {
  console.log(`  V${t.virality} H${t.heat} ${t.verdict.call.padEnd(4)} ${t.verdict.score} ${t.metrics.perHour}/h | ${t.title.slice(0, 50)} | ${t.verdict.reasons.join("; ")}`);
}
console.log("bottom:");
for (const t of [...topics].sort((a, b) => a.verdict.score - b.verdict.score).slice(0, 4)) {
  console.log(`  V${t.virality} H${t.heat} ${t.verdict.call} ${t.verdict.score} | ${t.title.slice(0, 50)} | ${t.verdict.reasons.join("; ")}`);
}
}

main();

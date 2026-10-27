/** One niche's stored scan: posts read, topic sizes and verdicts. Read-only. `npx tsx scripts/scan-report.ts tech-ai` */
import "./load-env";
import { loadScan } from "@/lib/pulse/scan";

async function main() {
  const s = await loadScan(process.argv[2] ?? "tech-ai");
  if (!s) return console.log("no scan");
  console.log(`read ${s.postsRead ?? "?"} · kept ${s.posts.length} · ${s.topics.length} topics · ${s.topics.reduce((a, t) => a + t.postIds.length, 0)} posts in topics`);
  for (const t of s.topics) console.log(`  ${String(t.postIds.length).padStart(3)} posts · H${t.heat} V${t.virality} ${t.verdict.call.padEnd(4)} ${t.verdict.score} ${t.metrics.perHour}/h new=${t.isNew} d=${t.heatDelta} 24h=${t.metrics.last24h} | ${t.title.slice(0, 40)} | ${t.verdict.reasons.join("; ")}`);
}
main();

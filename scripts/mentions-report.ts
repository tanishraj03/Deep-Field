/** Mentions per topic in one niche's stored scan. Read-only. `npx tsx scripts/mentions-report.ts tech-ai` */
import "./load-env";
import { loadScan } from "@/lib/pulse/scan";
import { mentionsOf } from "@/lib/view";

async function main() {
  const s = await loadScan(process.argv[2] ?? "tech-ai");
  if (!s) return console.log("no scan");
  let total = 0;
  for (const t of s.topics) {
    const m = mentionsOf(t, "ALL");
    total += m.total;
    console.log(`  ${String(m.total).padStart(7)} mentions (threads ${m.threads}, bsky ${m.bluesky}${m.capped ? "+" : ""}, hn ${m.hackernews}) "${t.web?.query ?? "-"}" | ${t.title.slice(0, 50)}`);
  }
  console.log(`total ${total} mentions across ${s.topics.length} topics · ${s.postsRead} posts read`);
}
main();

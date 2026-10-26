/**
 * Runs a scan from the command line, with no serverless time limit.
 *
 *   npm run scan                 every niche, then the cross-internet signals
 *   npm run scan -- tech-ai food  only these niches
 *   npm run scan -- --signals    only the signals
 *   npm run scan -- --no-ai      group by shared words, no model calls
 */
import "./load-env";
import { NICHES } from "../lib/niches";
import { scanNiche, scanSignals } from "../lib/pulse/scan";
import { compact } from "../lib/utils";

const args = process.argv.slice(2);
const ai = !args.includes("--no-ai");
const onlySignals = args.includes("--signals");
const picked = args.filter((a) => !a.startsWith("--"));
const niches = onlySignals ? [] : picked.length ? picked : NICHES.map((n) => n.id);

(async () => {
  for (const id of niches) {
    const t = Date.now();
    try {
      const s = await scanNiche(id, { ai });
      const top = s.topics.slice(0, 3).map((x) => `${x.heat} ${x.title}`).join(" | ");
      console.log(`✓ ${id.padEnd(14)} ${String(s.topics.length).padStart(2)} topics  ${String(s.posts.length).padStart(3)} posts  ${((Date.now() - t) / 1000).toFixed(1)}s  ${s.model ?? "rules"}`);
      console.log(`    ${top}`);
      for (const src of s.sources.filter((x) => !x.ok || x.note)) console.log(`    ! ${src.source}: ${src.note ?? "failed"}`);
      if (s.aiNote) console.log(`    ! ${s.aiNote}`);
    } catch (e) {
      console.log(`✗ ${id}: ${(e as Error).message}`);
    }
  }
  if (onlySignals || !picked.length) {
    const s = await scanSignals();
    console.log(`✓ signals: ${s.signals.length} — ${s.sources.map((x) => `${x.source} ${x.ok ? x.count : "✗ " + x.note}`).join(", ")}`);
    console.log(`    top: ${s.signals.sort((a, b) => b.value - a.value).slice(0, 4).map((x) => `${x.title} (${compact(x.value)})`).join(", ")}`);
  }
})();

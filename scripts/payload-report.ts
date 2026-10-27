/** What the Pulse payload is made of, by field. Read-only. `npx tsx scripts/payload-report.ts` */
import "./load-env";
import { loadPulse } from "@/lib/pulse/scan";

async function main() {
  const t0 = Date.now();
  const { scans, signals } = await loadPulse();
  console.log(`loadPulse ${Date.now() - t0}ms`);
  const size = (x: unknown) => JSON.stringify(x ?? null).length;
  const fields: Record<string, number> = {};
  for (const s of scans) for (const [k, v] of Object.entries(s)) fields[k] = (fields[k] ?? 0) + size(v);
  const topicFields: Record<string, number> = {};
  for (const s of scans) for (const t of s.topics) for (const [k, v] of Object.entries(t)) topicFields[k] = (topicFields[k] ?? 0) + size(v);
  console.log("scan fields (KB):", Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Math.round(v / 1024)])));
  console.log("topic fields (KB):", Object.fromEntries(Object.entries(topicFields).map(([k, v]) => [k, Math.round(v / 1024)])));
  console.log("signals KB", Math.round(size(signals) / 1024));
}
main();

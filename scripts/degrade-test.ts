/**
 * Worst-case rehearsal: every source unreachable, no AI key, no database.
 * The morning must still happen. Run: npx tsx scripts/degrade-test.ts
 *
 * Config is read at module load, so the env is set before any dynamic import.
 */
process.env.MOCK_DATA = "false";
process.env.FREE_ONLY = "true";
delete process.env.GEMINI_API_KEY;

async function main() {
  const { runPipeline } = await import("../lib/ingestion/pipeline");
  const { generateBrief } = await import("../lib/brief/generate");
  const { formatBrief } = await import("../lib/slack");

  const started = Date.now();
  const { run, items } = await runPipeline();

  console.log(`  mode            : ${run.mode}`);
  console.log(`  sources checked : ${run.sourcesChecked}`);
  console.log(`  sources failed  : ${run.sourcesFailed}`);
  console.log(`  raw items       : ${run.rawItems}`);
  console.log(`  items produced  : ${items.length}`);
  console.log(`  ai requests     : ${run.aiRequests} (skipped: ${run.aiSkipped})`);
  console.log(`  wall time       : ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  pipeline threw  : no`);
  console.log(`\n  first 3 failures:`);
  for (const f of run.runs.filter((r) => !r.ok).slice(0, 3)) {
    console.log(`    ${f.source.padEnd(24)} ${f.error}`);
  }

  const brief = await generateBrief(items);
  console.log(`\n  brief written   : ${brief.id} via ${brief.theSignal.generatedBy}`);
  console.log(`  slack payload   : ${formatBrief(brief, items).length} chars, still deliverable`);
}

main().catch((e) => { console.error("  PIPELINE THREW — this is the failure case:", e); process.exit(1); });

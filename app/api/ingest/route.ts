import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runPipeline } from "@/lib/ingestion/pipeline";
import { generateBrief } from "@/lib/brief/generate";
import { formatBrief, sendToSlack } from "@/lib/slack";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // within the free/Hobby function limit

/**
 * The one endpoint the scheduler calls.
 *
 * POST /api/ingest            → collect, dedupe, analyse, score
 * POST /api/ingest?brief=1    → also write the daily brief
 * POST /api/ingest?slack=1    → also deliver it to Slack
 *
 * Protected by a shared secret so a public URL cannot be used to burn quota.
 */
export async function POST(req: Request) {
  if (config.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${config.cronSecret}`) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const wantBrief = url.searchParams.get("brief") === "1";
  const wantSlack = url.searchParams.get("slack") === "1";

  try {
    const { run, items } = await runPipeline();

    let briefId: string | null = null;
    let slack: { ok: boolean; error?: string; skipped?: boolean } | null = null;

    if (wantBrief || wantSlack) {
      const brief = await generateBrief(items);
      briefId = brief.id;
      if (wantSlack) slack = await sendToSlack(formatBrief(brief, items));
    }

    return NextResponse.json({
      ok: true,
      mode: run.mode,
      sourcesChecked: run.sourcesChecked,
      sourcesFailed: run.sourcesFailed,
      rawItems: run.rawItems,
      duplicatesRemoved: run.duplicatesRemoved,
      newSignals: run.newSignals,
      aiRequests: run.aiRequests,
      aiSkipped: run.aiSkipped,
      aiSkipReason: run.aiSkipReason ?? null,
      briefId,
      slack,
      failures: run.runs.filter((r) => !r.ok).map((r) => ({ source: r.source, error: r.error })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "pipeline failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ hint: "POST to run ingestion. Include Authorization: Bearer <CRON_SECRET>." });
}

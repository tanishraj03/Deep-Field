import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/ingestion/pipeline";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Manual refresh, triggered from the interface.
 *
 * Unlike /api/ingest this has no shared secret, because it is called from a
 * page anyone holding the URL can already open. It is therefore throttled:
 * a refresh is a real cost (network to ~27 publishers, and AI quota), so one
 * caller cannot spend the day's budget by holding down a button.
 *
 * The window is process-local. On serverless that means per warm container
 * rather than global, which is a weaker guarantee than it looks — the AI
 * quota valve in lib/ai/usage.ts remains the actual spend ceiling.
 */
const COOLDOWN_MS = 3 * 60_000;
let lastRunAt = 0;
let inFlight: Promise<unknown> | null = null;

export async function POST() {
  const now = Date.now();
  const waited = now - lastRunAt;

  if (inFlight) {
    return NextResponse.json(
      { ok: false, reason: "A refresh is already running.", retryInMs: 0 },
      { status: 409 },
    );
  }
  if (waited < COOLDOWN_MS) {
    const retryInMs = COOLDOWN_MS - waited;
    return NextResponse.json(
      {
        ok: false,
        reason: `Refreshed ${Math.round(waited / 1000)}s ago. Sources are read at a walking pace, once every ${COOLDOWN_MS / 60000} minutes.`,
        retryInMs,
      },
      { status: 429 },
    );
  }

  lastRunAt = now;
  try {
    inFlight = runPipeline();
    const { run, items } = (await inFlight) as Awaited<ReturnType<typeof runPipeline>>;
    const repo = await getRepository();
    const saved = await repo.listItems(1);
    return NextResponse.json({
      ok: true,
      mode: run.mode,
      sourcesChecked: run.sourcesChecked,
      sourcesFailed: run.sourcesFailed,
      itemsShown: items.length,
      persisted: saved.length > 0,
      aiRequests: run.aiRequests,
      aiSkipped: run.aiSkipped,
      aiSkipReason: run.aiSkipReason ?? null,
      finishedAt: run.finishedAt,
    });
  } catch (err) {
    // Let the next attempt through rather than locking the button out.
    lastRunAt = 0;
    return NextResponse.json(
      { ok: false, reason: err instanceof Error ? err.message : "Refresh failed." },
      { status: 500 },
    );
  } finally {
    inFlight = null;
  }
}

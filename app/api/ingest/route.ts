import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runPipeline, runInterpretation } from "@/lib/ingestion/pipeline";
import { generateBrief } from "@/lib/brief/generate";
import { formatBrief, sendToSlack } from "@/lib/slack";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // within the free/Hobby function limit

/** Current hour in IST, regardless of where the server is. */
function istHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false,
  }).format(now));
}

/**
 * The one endpoint the scheduler calls, in four separate stages.
 *
 * Stages exist because a Hobby function is killed at 60 seconds. Collecting
 * from forty sources, pacing AI calls to respect the per-minute limit, writing
 * the brief and posting to Slack cannot all happen inside one request — the
 * daily run was returning 504. Each stage now does one thing and returns.
 *
 *   ?stage=collect   collect, deduplicate, score, persist. No AI.
 *   ?stage=analyse   interpret stored items that have no analysis yet.
 *   ?stage=brief     write the brief from stored items. No collection.
 *   ?stage=deliver   post the stored brief to Slack. No collection, no AI.
 *
 * `&scheduled=1` on deliver means the clock asked rather than a person, so the
 * brief is only sent at the hour configured in Settings.
 *
 * The older flags (?brief=1&slack=1) still work and still run everything, for
 * a manual full run where no timeout applies.
 */
export async function POST(req: Request) {
  if (config.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${config.cronSecret}`) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");
  const scheduled = url.searchParams.get("scheduled") === "1";

  try {
    switch (stage) {
      case "collect": {
        const { run } = await runPipeline({ withAI: false });
        return NextResponse.json({ ok: true, stage, ...summarise(run) });
      }

      case "analyse": {
        const result = await runInterpretation();
        return NextResponse.json({ ok: true, stage, ...result });
      }

      case "brief": {
        const repo = await getRepository();
        const items = await repo.listItems(200);
        if (items.length === 0) {
          return NextResponse.json(
            { ok: true, stage, skipped: true, reason: "Nothing collected yet — run stage=collect first." },
          );
        }
        const brief = await generateBrief(items);
        return NextResponse.json({
          ok: true, stage, briefId: brief.id,
          buckets: brief.contentBuckets.length,
          writtenBy: brief.theSignal.generatedBy,
        });
      }

      case "deliver": {
        const repo = await getRepository();
        const [brief, items] = await Promise.all([repo.latestBrief(), repo.listItems(200)]);
        if (!brief) {
          return NextResponse.json(
            { ok: true, stage, skipped: true, reason: "No brief written yet — run stage=brief first." },
          );
        }
        const due = (await repo.getSettings()).briefHourIst;
        const hour = istHour();
        if (scheduled && hour !== due) {
          return NextResponse.json({
            ok: true, stage, skipped: true,
            reason: `Not due — brief is set for ${String(due).padStart(2, "0")}:00 IST, it is ${String(hour).padStart(2, "0")}:00 IST.`,
          });
        }
        const slack = await sendToSlack(formatBrief(brief, items));
        return NextResponse.json({ ok: true, stage, briefId: brief.id, slack });
      }
    }

    // No stage: the original all-in-one behaviour.
    const wantBrief = url.searchParams.get("brief") === "1";
    const wantSlack = url.searchParams.get("slack") === "1";
    const { run, items } = await runPipeline();

    let briefId: string | null = null;
    let slack: { ok: boolean; error?: string; skipped?: boolean } | null = null;

    if (wantBrief || wantSlack) {
      const brief = await generateBrief(items);
      briefId = brief.id;
      if (wantSlack) {
        const due = (await (await getRepository()).getSettings()).briefHourIst;
        const hour = istHour();
        if (scheduled && hour !== due) {
          slack = { ok: false, skipped: true, error: `Not due — brief is set for ${String(due).padStart(2, "0")}:00 IST, it is ${String(hour).padStart(2, "0")}:00 IST.` };
        } else {
          slack = await sendToSlack(formatBrief(brief, items));
        }
      }
    }

    return NextResponse.json({ ok: true, ...summarise(run), briefId, slack });
  } catch (err) {
    return NextResponse.json(
      { ok: false, stage, error: err instanceof Error ? err.message : "pipeline failed" },
      { status: 500 },
    );
  }
}

function summarise(run: Awaited<ReturnType<typeof runPipeline>>["run"]) {
  return {
    mode: run.mode,
    sourcesChecked: run.sourcesChecked,
    sourcesFailed: run.sourcesFailed,
    rawItems: run.rawItems,
    duplicatesRemoved: run.duplicatesRemoved,
    newSignals: run.newSignals,
    aiRequests: run.aiRequests,
    aiSkipped: run.aiSkipped,
    aiSkipReason: run.aiSkipReason ?? null,
    failures: run.runs.filter((r) => !r.ok).map((r) => ({ source: r.source, error: r.error })),
  };
}

export async function GET() {
  return NextResponse.json({
    hint: "POST with ?stage=collect|analyse|brief|deliver and Authorization: Bearer <CRON_SECRET>.",
  });
}

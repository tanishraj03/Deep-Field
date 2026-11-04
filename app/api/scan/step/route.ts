import { after, NextResponse, type NextRequest } from "next/server";
import { readStepToken, runStep } from "@/lib/scan-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One step of a server-side scan (lib/scan-jobs.ts). Called by the previous
 * step, never by the browser, with a signed token naming the job. Answers at
 * once and does the scanning after, so steps never wait on each other.
 */
export async function POST(req: NextRequest) {
  const step = readStepToken(req.headers.get("authorization"));
  if (!step) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  after(() => runStep(step.jid, step.uid).catch((e) => console.error("Scan step failed:", e)));
  return NextResponse.json({ ok: true }, { status: 202 });
}

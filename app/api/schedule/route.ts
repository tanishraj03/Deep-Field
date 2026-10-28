import { NextResponse, type NextRequest } from "next/server";
import { isCron, ownerOnly, withUser } from "@/lib/auth";
import { claimDue, getSchedule, nextRun, saveSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** The daily scan schedule, for Settings. */
export async function GET() {
  return withUser(async () => {
    const s = await getSchedule();
    return NextResponse.json({ ok: true, schedule: s, next: nextRun(s) });
  });
}

/** Change the time or turn it off, from Settings. The daily scan spends the server's keys, so only the owner may. */
export async function PUT(req: NextRequest) {
  return withUser(async (user) => ownerOnly(user) ?? saveFrom(req));
}

async function saveFrom(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { hour?: number; enabled?: boolean };
  try {
    const s = await saveSchedule(body);
    return NextResponse.json({ ok: true, schedule: s, next: nextRun(s) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

/**
 * The hourly scheduler asks "is it time?". Only it may claim a run, so this
 * needs CRON_SECRET; a "yes" also marks today as done.
 */
export async function POST(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await claimDue()) });
}

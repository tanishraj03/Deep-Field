import { NextResponse, type NextRequest } from "next/server";
import { isCron } from "@/lib/auth";
import { startSystemJob } from "@/lib/scan-jobs";
import { claimDue } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/**
 * The daily scan's trigger, called by Vercel Cron (vercel.json) and by the
 * GitHub workflow as a backup, both with CRON_SECRET. Whichever comes first
 * at or after the hour set in the admin dashboard starts the scan; the other
 * finds the day already claimed. The scan itself runs as a server-side job
 * (lib/scan-jobs.ts), one niche per request, on the server's own keys.
 * ?force=1 (the workflow's manual run) skips the schedule check.
 */
export async function GET(req: NextRequest) {
  if (!isCron(req)) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const force = req.nextUrl.searchParams.get("force") === "1";
  const claim = force ? { due: true, reason: "Run by hand." } : await claimDue();
  if (!claim.due) return NextResponse.json({ ok: true, started: false, reason: claim.reason });
  const job = await startSystemJob(req.nextUrl.origin);
  return NextResponse.json({ ok: true, started: true, reason: claim.reason, job: { id: job.id, items: job.items.length } });
}

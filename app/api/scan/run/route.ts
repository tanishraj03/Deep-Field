import { NextResponse, type NextRequest } from "next/server";
import { withUser } from "@/lib/auth";
import { NICHE_BY_ID } from "@/lib/niches";
import { track } from "@/lib/platform";
import { getJob, isStalled, scanBlocked, startJob, type ScanJob } from "@/lib/scan-jobs";

export const dynamic = "force-dynamic";

const view = (j: ScanJob | null) => j && {
  id: j.id, status: j.status, stalled: isStalled(j), startedAt: j.startedAt, updatedAt: j.updatedAt,
  items: j.items, results: j.results,
};

/** Your latest scan job and how far it got. The page polls this. */
export async function GET() {
  return withUser(async (user) => NextResponse.json({ ok: true, job: view(await getJob(user.id)) }));
}

/** Start a scan that runs on the server: { niches: string[], signals?: boolean }. Resumes a stalled one. */
export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const b = (await req.json().catch(() => ({}))) as { niches?: unknown; signals?: unknown };
    const niches = Array.isArray(b.niches) ? b.niches.filter((n): n is string => typeof n === "string" && NICHE_BY_ID.has(n)).slice(0, 30) : [];
    const blocked = await scanBlocked(user);
    if (blocked) return NextResponse.json({ ok: false, ...blocked }, { status: 403 });
    track(user.id, "scans");
    const job = await startJob(user, niches, b.signals === true, req.nextUrl.origin);
    return NextResponse.json({ ok: true, job: view(job) });
  });
}

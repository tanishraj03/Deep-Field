import { NextResponse, type NextRequest } from "next/server";
import { backgroundModel } from "@/lib/ai/models";
import { isAdmin, isCron, withUserOrCron } from "@/lib/auth";
import { NICHE_BY_ID, NICHES } from "@/lib/niches";
import { scanKey, SIGNALS_KEY } from "@/lib/pulse/scan";
import { scanItem } from "@/lib/scan-jobs";
import { getPlatform, track } from "@/lib/platform";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** What can be scanned, and when each was last scanned. The scheduler reads this. */
export async function GET(req: NextRequest) {
  return withUserOrCron(req, async () => {
    const docs = await store.list<unknown>("scan:");
    const at = new Map(docs.map((d) => [d.key, d.updatedAt]));
    return NextResponse.json({
      niches: NICHES.map((n) => ({ id: n.id, label: n.label, scannedAt: at.get(scanKey(n.id)) ?? null })),
      signalsAt: (await store.get(SIGNALS_KEY))?.updatedAt ?? null,
    });
  });
}

/**
 * One niche per request (?niche=food), or the cross-internet signals
 * (?signals=1). One niche fits comfortably inside a serverless time limit;
 * the whole catalogue does not, so the interface and the scheduler walk the
 * list one request at a time.
 *
 * The scheduler holds CRON_SECRET and scans with the server's keys. A
 * signed-in user scans with their own keys, and needs an AI key to do it:
 * scans are shared by everyone, and a keyless rescan would replace named,
 * AI-grouped conversations with keyword groups for every user. A niche is
 * not rescanned more often than SCAN_COOLDOWN_MS except by the scheduler.
 */
export async function POST(req: NextRequest) {
  const cron = isCron(req);
  return withUserOrCron(req, async (user) => {
    // The admin can leave refreshing to the daily scan alone (Platform tab).
    if (!cron && !isAdmin(user) && !(await getPlatform()).userScans) {
      return NextResponse.json({ ok: false, error: "Scans refresh automatically once a day right now, so there's nothing to run." }, { status: 403 });
    }
    if (!cron && !backgroundModel()) {
      return NextResponse.json({ ok: false, error: "Add a free Gemini or Groq key in Keys to run scans.", needsKey: true }, { status: 403 });
    }
    if (user) track(user.id, "scans");
    return scan(req, cron);
  });
}

async function scan(req: NextRequest, authorized: boolean) {
  const url = new URL(req.url);
  const signals = url.searchParams.get("signals") === "1";
  const niche = url.searchParams.get("niche") ?? "";
  if (!signals && !NICHE_BY_ID.has(niche)) {
    return NextResponse.json({ ok: false, error: `Unknown niche "${niche}"` }, { status: 400 });
  }
  try {
    const r = await scanItem(signals ? "signals" : niche, { ignoreCooldown: authorized });
    return NextResponse.json({ ok: r.ok, niche: signals ? undefined : niche, skipped: r.skipped, detail: r.detail });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

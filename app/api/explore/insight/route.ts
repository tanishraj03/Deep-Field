import { NextResponse, type NextRequest } from "next/server";
import { withUser } from "@/lib/auth";
import { limited } from "@/lib/rate-limit";
import { track } from "@/lib/platform";
import { exploreInsight } from "@/lib/explore";
import type { RegionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REGIONS = new Set<string>(["ALL", "IN", "GLOBAL"]);

export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const slow = limited(user.id, "insight");
    if (slow) return slow;
    track(user.id, "insights");
    return insight(req);
  });
}

async function insight(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { q?: string; region?: RegionFilter; model?: string };
  try {
    const q = typeof body.q === "string" ? body.q.slice(0, 200) : "";
    const region = REGIONS.has(body.region ?? "") ? body.region! : "ALL";
    const insight = await exploreInsight(q, region, typeof body.model === "string" ? body.model : undefined);
    return NextResponse.json({ ok: true, insight });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

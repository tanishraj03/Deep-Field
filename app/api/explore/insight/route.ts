import { NextResponse, type NextRequest } from "next/server";
import { exploreInsight } from "@/lib/explore";
import type { RegionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { q?: string; region?: RegionFilter; model?: string };
  try {
    const insight = await exploreInsight(body.q ?? "", body.region ?? "ALL", body.model);
    return NextResponse.json({ ok: true, insight });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

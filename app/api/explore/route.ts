import { NextResponse, type NextRequest } from "next/server";
import { withUser } from "@/lib/auth";
import { track } from "@/lib/platform";
import { explore } from "@/lib/explore";
import type { RegionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REGIONS = new Set(["ALL", "IN", "GLOBAL"]);

export async function GET(req: NextRequest) {
  return withUser((user) => { track(user.id, "searches"); return search(req); });
}

async function search(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 200);
  const region = (REGIONS.has(url.searchParams.get("region") ?? "") ? url.searchParams.get("region") : "ALL") as RegionFilter;
  try {
    const result = await explore(q, region, { fresh: url.searchParams.get("fresh") === "1" });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

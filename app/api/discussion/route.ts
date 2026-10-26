import { NextResponse, type NextRequest } from "next/server";
import { queryDiscussion, topicDiscussion } from "@/lib/discussion";
import type { RegionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REGIONS = new Set(["ALL", "IN", "GLOBAL"]);

/** ?topic=<niche>:<id> for a scanned topic, or ?q=<query>&region=<r> for an Explore search. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const fresh = p.get("fresh") === "1";
  try {
    const topic = p.get("topic");
    if (topic?.includes(":")) {
      const [niche, id] = topic.split(":");
      return NextResponse.json({ ok: true, discussion: await topicDiscussion(niche, id, { fresh }) });
    }
    const region = (REGIONS.has(p.get("region") ?? "") ? p.get("region") : "ALL") as RegionFilter;
    return NextResponse.json({ ok: true, discussion: await queryDiscussion(p.get("q") ?? "", region, { fresh }) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { formatBrief, sendToSlack } from "@/lib/slack";
import { getSnapshot } from "@/lib/snapshot";
import { istClock } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Sends whatever the latest brief is, so the test proves the real path works. */
export async function POST() {
  const snapshot = await getSnapshot();
  const text = snapshot.brief
    ? formatBrief(snapshot.brief, snapshot.items)
    : `🌅 *Daily Intelligence — connection test*\nSent ${istClock()} IST. No brief has been generated yet.`;

  const result = await sendToSlack(text);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

import { NextResponse } from "next/server";
import { getSystemStatus } from "@/lib/snapshot";
import { enabledSources } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSystemStatus();
  return NextResponse.json({ ...status, sourcesConfigured: enabledSources().length });
}

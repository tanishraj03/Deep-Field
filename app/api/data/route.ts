import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSnapshot());
}

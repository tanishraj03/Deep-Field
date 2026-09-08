import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";
import { generateBrief } from "@/lib/brief/generate";
import { getSnapshot } from "@/lib/snapshot";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  if (snapshot.brief) return NextResponse.json(snapshot.brief);
  return NextResponse.json({ error: "No brief generated yet. Run ingestion first." }, { status: 404 });
}

export async function POST(req: Request) {
  if (config.cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${config.cronSecret}`) {
      return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    }
  }
  const repo = await getRepository();
  const items = await repo.listItems(200);
  if (!items.length) {
    return NextResponse.json({ error: "No items stored. Run /api/ingest first." }, { status: 409 });
  }
  return NextResponse.json(await generateBrief(items));
}

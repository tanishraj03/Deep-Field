import { NextResponse, type NextRequest } from "next/server";
import { contextMarkdown, type ExportContext } from "@/lib/export";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The research a chat was opened from, as Markdown, for taking to another AI. */
export async function POST(req: NextRequest) {
  const { context } = (await req.json().catch(() => ({}))) as { context?: ExportContext };
  if (!context) return NextResponse.json({ ok: true, markdown: "" });
  try {
    return NextResponse.json({ ok: true, markdown: await contextMarkdown(context) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}

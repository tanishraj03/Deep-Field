import { NextResponse } from "next/server";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const repo = await getRepository();
  const settings = await repo.getSettings();
  return NextResponse.json({ ok: true, settings, persistent: repo.persistent });
}

/** Change the hour the brief is delivered. IST, 0-23. */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { body = {}; }
  const raw = (body as { briefHourIst?: unknown }).briefHourIst;
  const hour = Number(raw);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return NextResponse.json(
      { ok: false, error: "briefHourIst must be a whole number from 0 to 23." },
      { status: 400 },
    );
  }

  const repo = await getRepository();
  const settings = await repo.saveSettings({ briefHourIst: hour });
  return NextResponse.json({
    ok: true,
    settings,
    // Said plainly rather than implied: without a database this is per-container.
    persistent: repo.persistent,
    note: repo.persistent
      ? "Saved."
      : "Saved for this instance only — no database is configured, so serverless will reset it.",
  });
}

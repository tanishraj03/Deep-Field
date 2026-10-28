import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { getPlatform, recordAdmin, savePlatform, type PlatformSettings } from "@/lib/platform";

export const dynamic = "force-dynamic";

const MAX_ANNOUNCEMENT = 280;

/**
 * Change platform switches: any of { signupsOpen, userScans, announcement }.
 * announcement is { text, tone } to show one, or null to take it down.
 */
export async function PUT(req: Request) {
  return withAdmin(req, async () => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const now = await getPlatform();
    const next: PlatformSettings = { ...now };
    const changes: string[] = [];

    if (typeof body.signupsOpen === "boolean" && body.signupsOpen !== now.signupsOpen) {
      next.signupsOpen = body.signupsOpen;
      changes.push(body.signupsOpen ? "Opened sign-ups" : "Closed sign-ups");
    }
    if (typeof body.userScans === "boolean" && body.userScans !== now.userScans) {
      next.userScans = body.userScans;
      changes.push(body.userScans ? "Let people refresh scans" : "Stopped people refreshing scans");
    }
    if ("announcement" in body) {
      const a = body.announcement as { text?: unknown; tone?: unknown } | null;
      if (a === null) {
        if (now.announcement) changes.push("Took down the announcement");
        next.announcement = null;
      } else {
        const text = typeof a?.text === "string" ? a.text.trim() : "";
        if (!text) return NextResponse.json({ ok: false, error: "Write the announcement first." }, { status: 400 });
        if (text.length > MAX_ANNOUNCEMENT) {
          return NextResponse.json({ ok: false, error: `Keep it under ${MAX_ANNOUNCEMENT} characters.` }, { status: 400 });
        }
        next.announcement = { text, tone: a?.tone === "warning" ? "warning" : "info", at: new Date().toISOString() };
        changes.push(`Announced: "${text}"`);
      }
    }

    if (!changes.length) return NextResponse.json({ ok: true, platform: now });
    await savePlatform(next);
    for (const c of changes) await recordAdmin({ action: c, target: "platform" });
    return NextResponse.json({ ok: true, platform: next });
  });
}

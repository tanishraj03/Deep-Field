import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { getUser, isAdmin, setSuspended } from "@/lib/auth/users";
import { recordAdmin } from "@/lib/platform";

export const dynamic = "force-dynamic";

/**
 * Suspend someone or restore them: { uid, action: "suspend" | "restore", reason? }.
 * A suspension signs them out on their next request and stops them signing in.
 */
export async function POST(req: Request) {
  return withAdmin(req, async () => {
    const body = (await req.json().catch(() => ({}))) as { uid?: unknown; action?: unknown; reason?: unknown };
    if (typeof body.uid !== "string" || !/^g:[0-9]{1,40}$/.test(body.uid)) {
      return NextResponse.json({ ok: false, error: "Unknown account." }, { status: 400 });
    }
    if (body.action !== "suspend" && body.action !== "restore") {
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }
    const target = await getUser(body.uid);
    if (!target) return NextResponse.json({ ok: false, error: "That account no longer exists." }, { status: 404 });
    if (isAdmin(target)) return NextResponse.json({ ok: false, error: "The admin account can't be suspended." }, { status: 400 });

    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) || null : null;
    const next = await setSuspended(target.id, body.action === "suspend" ? { at: new Date().toISOString(), reason } : null);
    await recordAdmin({
      action: body.action === "suspend" ? "Suspended" : "Restored",
      target: target.email,
      detail: reason ?? undefined,
    });
    return NextResponse.json({ ok: true, suspended: next?.suspended ?? null });
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { withUser } from "@/lib/auth";
import { isOwner, keyStatus, removeKeys, restoreServerKeys, saveKeys } from "@/lib/auth/users";
import { verifyKey } from "@/lib/auth/verify-key";
import type { KeyField } from "@/lib/keys";
import { INTEGRATION_BY_ID, type IntegrationId } from "@/lib/keys-catalog";

export const dynamic = "force-dynamic";

/** Which keys the signed-in user has added. Never the keys themselves. */
export async function GET() {
  return withUser(async (user) => NextResponse.json({ ok: true, keys: await keyStatus(user) }));
}

/**
 * Check and save one integration's key(s): { integration, values: { field: value } }.
 * The owner can also switch a server key back on: { integration, restoreServer: true }.
 */
export async function PUT(req: NextRequest) {
  return withUser(async (user) => {
    const body = (await req.json().catch(() => ({}))) as { integration?: string; values?: Record<string, unknown>; restoreServer?: boolean };
    const integ = INTEGRATION_BY_ID.get(body.integration as IntegrationId);
    if (!integ) return NextResponse.json({ ok: false, error: "Unknown key type." }, { status: 400 });
    if (body.restoreServer) {
      if (!isOwner(user)) return NextResponse.json({ ok: false, error: "Only the owner has server keys." }, { status: 403 });
      await restoreServerKeys(user.id, integ.fields.map((f) => f.field));
      return NextResponse.json({ ok: true, keys: await keyStatus(user) });
    }

    const values: Partial<Record<KeyField, string>> = {};
    for (const f of integ.fields) {
      const v = typeof body.values?.[f.field] === "string" ? (body.values[f.field] as string).trim() : "";
      if (!v) return NextResponse.json({ ok: false, error: `Fill in the ${f.label.toLowerCase()}.` }, { status: 400 });
      if (v.length > 2048 || /\s/.test(v)) return NextResponse.json({ ok: false, error: `That ${f.label.toLowerCase()} doesn't look right: keys have no spaces.` }, { status: 400 });
      values[f.field] = v;
    }

    const check = await verifyKey(integ.id, values);
    if (check.result === "invalid") return NextResponse.json({ ok: false, error: check.reason }, { status: 400 });
    await saveKeys(user.id, values);
    return NextResponse.json({ ok: true, note: check.result === "unknown" ? `Saved. ${check.reason}` : null, keys: await keyStatus(user) });
  });
}

/** Remove one integration's key(s): ?integration=<id>. */
export async function DELETE(req: NextRequest) {
  return withUser(async (user) => {
    const integ = INTEGRATION_BY_ID.get(req.nextUrl.searchParams.get("integration") as IntegrationId);
    if (!integ) return NextResponse.json({ ok: false, error: "Unknown key type." }, { status: 400 });
    await removeKeys(user, integ.fields.map((f) => f.field));
    return NextResponse.json({ ok: true, keys: await keyStatus(user) });
  });
}

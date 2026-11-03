import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/admin";
import { nicheLabel } from "@/lib/niches";
import { recordAdmin } from "@/lib/platform";
import { decide } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

/** Approve or reject a suggested community: { niche, sub, status: "approved" | "rejected" }. */
export async function PUT(req: Request) {
  return withAdmin(req, async () => {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (b.status !== "approved" && b.status !== "rejected") {
      return NextResponse.json({ ok: false, error: "Approve or reject." }, { status: 400 });
    }
    try {
      const s = await decide(String(b.niche ?? ""), String(b.sub ?? ""), b.status);
      await recordAdmin({
        action: s.status === "approved" ? "Approved a community" : "Rejected a community",
        target: `r/${s.sub}`,
        detail: `${nicheLabel(s.niche)} · ${s.region === "IN" ? "India" : "Global"}`,
      });
      return NextResponse.json({ ok: true, suggestion: s });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
    }
  });
}

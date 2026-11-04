import { NextResponse, type NextRequest } from "next/server";
import { withUser } from "@/lib/auth";
import { limited } from "@/lib/rate-limit";
import { suggest } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Suggest a community for a niche: { niche, sub, region: "IN" | "GLOBAL", why? }. Checked, then queued for the admin. */
export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const slow = limited(user.id, "suggest");
    if (slow) return slow;
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const s = await suggest({
        niche: String(b.niche ?? ""),
        sub: String(b.sub ?? ""),
        region: b.region === "IN" ? "IN" : "GLOBAL",
        why: typeof b.why === "string" ? b.why : null,
        uid: user.id,
        username: user.username,
      });
      return NextResponse.json({ ok: true, suggestion: { sub: s.sub, subscribers: s.subscribers, postsWeek: s.postsWeek } });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
    }
  });
}

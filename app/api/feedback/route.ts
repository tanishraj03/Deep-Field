import { NextResponse, type NextRequest } from "next/server";
import { withUser } from "@/lib/auth";
import { getFeedback, learning, markMade, OUTCOMES, refOf, reportOutcome, unmake, vote, type Outcome } from "@/lib/feedback";
import { loadScan } from "@/lib/pulse/scan";

export const dynamic = "force-dynamic";

/** The topic behind "<niche>:<id>", read from the scan, so a call or score can't be made up by the browser. */
async function topicRef(key: unknown) {
  if (typeof key !== "string" || !key.includes(":")) return null;
  const [niche, id] = key.split(":");
  const t = (await loadScan(niche))?.topics.find((x) => x.id === id);
  return t ? refOf(t) : null;
}

/**
 * ?topic=<niche>:<id>: your vote and whether you made it, plus everyone's tally.
 * No topic: everything you've made, for your track record.
 */
export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const [mine, l] = await Promise.all([getFeedback(user.id), learning()]);
    const key = req.nextUrl.searchParams.get("topic");
    if (!key) return NextResponse.json({ ok: true, made: mine.made, byCall: l.byCall });
    return NextResponse.json({
      ok: true,
      vote: mine.votes[key]?.vote ?? 0,
      made: mine.made.find((m) => m.topic.key === key) ?? null,
      tally: l.tally[key] ?? { up: 0, down: 0, made: 0 },
    });
  });
}

/**
 * { action: "vote", topic, vote: 1 | -1 | 0 }
 * { action: "made", topic, format?, url? }
 * { action: "outcome", id, result, views?, url? }
 * { action: "unmake", id }
 */
export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const bad = (error: string) => NextResponse.json({ ok: false, error }, { status: 400 });
    const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const url = (v: unknown) => {
      const s = text(v, 500);
      if (!s) return null;
      try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; }
    };

    if (b.action === "vote" || b.action === "made") {
      const ref = await topicRef(b.topic);
      if (!ref) return bad("That topic has been replaced by a newer scan. Open it again from Pulse.");
      if (b.action === "vote") {
        if (b.vote !== 1 && b.vote !== -1 && b.vote !== 0) return bad("Vote up, down or clear.");
        await vote(user.id, ref, b.vote);
      } else {
        await markMade(user.id, ref, text(b.format, 40), url(b.url));
      }
    } else if (b.action === "outcome") {
      const result = b.result as Outcome;
      if (typeof b.id !== "string" || !OUTCOMES.some((o) => o.value === result)) return bad("Pick how it did.");
      const views = typeof b.views === "number" && Number.isFinite(b.views) && b.views >= 0 ? Math.round(b.views) : null;
      await reportOutcome(user.id, b.id, result, views, url(b.url));
    } else if (b.action === "unmake") {
      if (typeof b.id !== "string") return bad("Which one?");
      await unmake(user.id, b.id);
    } else {
      return bad("Unknown action.");
    }
    const [mine, l] = await Promise.all([getFeedback(user.id), learning()]);
    const key = typeof b.topic === "string" ? b.topic : null;
    return NextResponse.json({
      ok: true,
      vote: key ? mine.votes[key]?.vote ?? 0 : 0,
      made: key ? mine.made.find((m) => m.topic.key === key) ?? null : null,
      tally: key ? l.tally[key] ?? { up: 0, down: 0, made: 0 } : null,
      all: mine.made,
    });
  });
}

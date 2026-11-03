import { TrackRecord } from "@/components/track-record";
import { requireUser } from "@/lib/auth";
import { getFeedback, learning } from "@/lib/feedback";

export const dynamic = "force-dynamic";
export const metadata = { title: "Track record" };

export default async function MadePage() {
  const user = await requireUser();
  const [mine, l] = await Promise.all([getFeedback(user.id), learning()]);
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Track record</h1>
        <p className="mt-1 text-sm text-muted">
          What you made from DeepField and how it did. Your results, together with other creators&apos;, are how DeepField learns which calls actually pay off.
        </p>
      </div>
      <TrackRecord initial={mine.made} community={{ people: l.people, reported: l.reported, byCall: l.byCall }} />
    </div>
  );
}

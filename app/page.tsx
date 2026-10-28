import { PulseView } from "@/components/pulse";
import { requireUser } from "@/lib/auth";
import { loadSummaries } from "@/lib/pulse/scan";

export const dynamic = "force-dynamic";

/** The board renders from slim summaries: no posts, so the page stays light. */
export default async function PulsePage({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const [{ niche }, pulse, user] = await Promise.all([searchParams, loadSummaries(), requireUser()]);
  return <PulseView scans={pulse.scans} signals={pulse.signals} initialNiche={niche ?? null} prefs={user.prefs} />;
}

import { PulseView } from "@/components/pulse";
import { loadSummaries } from "@/lib/pulse/scan";

export const dynamic = "force-dynamic";

/** The board renders from slim summaries: no posts, so the page stays light. */
export default async function PulsePage({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const [{ niche }, pulse] = await Promise.all([searchParams, loadSummaries()]);
  return <PulseView scans={pulse.scans} signals={pulse.signals} initialNiche={niche ?? null} />;
}

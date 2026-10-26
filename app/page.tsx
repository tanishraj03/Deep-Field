import { PulseView } from "@/components/pulse";
import { loadPulse } from "@/lib/pulse/scan";
import type { NicheScan } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Only what the board renders goes to the browser: each topic's first few
 * threads rather than every post read, which keeps the page light.
 */
function slim(scan: NicheScan): NicheScan {
  const keep = new Set(scan.topics.flatMap((t) => t.postIds.slice(0, 3)));
  return { ...scan, posts: scan.posts.filter((p) => keep.has(p.id)) };
}

export default async function PulsePage({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const [{ niche }, pulse] = await Promise.all([searchParams, loadPulse()]);
  return <PulseView scans={pulse.scans.map(slim)} signals={pulse.signals} initialNiche={niche ?? null} />;
}

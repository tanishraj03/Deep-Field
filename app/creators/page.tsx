import { CreatorsView } from "@/components/creators-view";
import { requireUser } from "@/lib/auth";
import { loadSummaries } from "@/lib/pulse/scan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Creators" };

/** Who is behind what's taking off, per niche, India and global. From the same scans as Pulse. */
export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const [{ niche }, user, pulse] = await Promise.all([searchParams, requireUser(), loadSummaries()]);
  const byNiche = Object.fromEntries(pulse.scans.map((s) => [s.niche, { creators: s.creators ?? [], scannedAt: s.scannedAt }]));
  return <CreatorsView byNiche={byNiche} initialNiche={niche ?? null} mine={user.prefs.niches} />;
}

import { ExploreView } from "@/components/explore-view";
import { loadSummaries } from "@/lib/pulse/scan";
import type { RegionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore" };

const REGIONS = new Set(["ALL", "IN", "GLOBAL"]);

/** Short searchable phrases from the hottest scanned topics. */
async function suggestions(): Promise<string[]> {
  const pulse = await loadSummaries().catch(() => null);
  if (!pulse) return ["ozempic", "creatine", "iPhone", "Zepto", "AI agents"];
  return pulse.scans
    .flatMap((s) => s.topics.slice(0, 2))
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 10)
    .map((t) => t.title.replace(/[“”"'’:\u2014\u2013|?!.,()]/g, " ").split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join(" "))
    .filter(Boolean);
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; region?: string }> }) {
  const { q, region } = await searchParams;
  return (
    <ExploreView
      initialQuery={q ?? ""}
      initialRegion={region && REGIONS.has(region) ? (region as RegionFilter) : null}
      suggestions={await suggestions()}
    />
  );
}

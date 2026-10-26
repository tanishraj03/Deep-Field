import { Assistant } from "@/components/assistant";
import { defaultChatModel, publicModelList } from "@/lib/ai/models";
import { nicheLabel } from "@/lib/niches";
import { loadScan } from "@/lib/pulse/scan";
import type { RegionFilter } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assistant" };

const REGIONS = new Set(["ALL", "IN", "GLOBAL"]);

/**
 * ?topic=<niche>:<id> opens a chat about a scanned topic;
 * ?q=<query>&region=<r> opens one about an Explore search.
 */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ topic?: string; q?: string; region?: string }> }) {
  const { topic, q, region } = await searchParams;
  let context: Parameters<typeof Assistant>[0]["initialContext"] = null;
  let label: string | null = null;

  if (topic?.includes(":")) {
    const [niche, topicId] = topic.split(":");
    const t = (await loadScan(niche))?.topics.find((x) => x.id === topicId);
    if (t) { context = { type: "topic", niche, topicId }; label = `${t.title} (${nicheLabel(niche)})`; }
  } else if (q) {
    const r = (region && REGIONS.has(region) ? region : "ALL") as RegionFilter;
    context = { type: "explore", query: q, region: r };
    label = `“${q}”${r === "IN" ? " in India" : r === "GLOBAL" ? " globally" : ""}`;
  }

  return (
    <Assistant
      models={publicModelList()}
      defaultModel={defaultChatModel()?.id ?? null}
      initialContext={context}
      contextLabel={label}
    />
  );
}

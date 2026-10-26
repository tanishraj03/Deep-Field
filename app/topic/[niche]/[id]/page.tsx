import { notFound } from "next/navigation";
import { TopicView } from "@/components/topic-view";
import { loadScan } from "@/lib/pulse/scan";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ niche: string; id: string }> };

async function find(niche: string, id: string) {
  const scan = await loadScan(niche);
  const topic = scan?.topics.find((t) => t.id === id);
  return scan && topic ? { scan, topic } : null;
}

export async function generateMetadata({ params }: Params) {
  const { niche, id } = await params;
  const hit = await find(niche, id);
  return { title: hit?.topic.title ?? "Topic" };
}

export default async function TopicPage({ params }: Params) {
  const { niche, id } = await params;
  const hit = await find(niche, id);
  // Topics are replaced each scan, so an old link can outlive its topic.
  if (!hit) notFound();
  return <TopicView topic={hit.topic} scan={hit.scan} />;
}

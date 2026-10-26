"use client";

import Link from "next/link";
import { ArrowBigUp, MessageSquare, Users } from "lucide-react";
import { nicheLabel } from "@/lib/niches";
import type { RegionFilter, SourceId, Topic } from "@/lib/types";
import { topicIn } from "@/lib/view";
import { cn } from "@/lib/utils";
import { Badge, Card, Delta, Heat, Metric, RegionSplit, SourceTag } from "./ui";

const SENTIMENT: Record<Topic["sentiment"], { label: string; tone: "rise" | "fall" | "neutral" | "outline" }> = {
  positive: { label: "Positive", tone: "rise" },
  negative: { label: "Negative", tone: "fall" },
  mixed: { label: "Mixed", tone: "outline" },
  neutral: { label: "Neutral", tone: "neutral" },
};

export function SentimentBadge({ s }: { s: Topic["sentiment"] }) {
  return <Badge tone={SENTIMENT[s].tone}>{SENTIMENT[s].label}</Badge>;
}

export function topicHref(t: Topic) {
  return `/topic/${t.niche}/${t.id}`;
}

export function TopicCard({ topic, region, showNiche, rank }: { topic: Topic; region: RegionFilter; showNiche?: boolean; rank?: number }) {
  const { metrics, heat } = topicIn(topic, region);
  return (
    <Link href={topicHref(topic)} className="group block h-full">
      <Card hover className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {rank !== undefined && <span className="num text-xs font-semibold text-faint">#{rank}</span>}
            {showNiche && <Badge tone="outline">{nicheLabel(topic.niche)}</Badge>}
            <Delta isNew={topic.isNew} delta={topic.heatDelta} />
          </div>
          <Heat value={heat} />
        </div>
        <h3 className="mt-2.5 line-clamp-2 text-[0.975rem] font-semibold leading-snug tracking-tight group-hover:text-accent">
          {topic.title}
        </h3>
        {topic.summary && <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">{topic.summary}</p>}
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Metric icon={MessageSquare} value={metrics.comments} label="comments" />
            <Metric icon={ArrowBigUp} value={metrics.score} label="upvotes" />
            <span className="text-xs text-muted"><span className="num font-medium text-ink/80">{metrics.posts}</span> posts</span>
            <Metric icon={Users} value={metrics.communities} label="communities" />
          </div>
          <div className={cn("mt-3 flex items-end justify-between gap-4")}>
            <div className="flex flex-wrap gap-x-2.5 gap-y-1">
              {(Object.entries(metrics.sources) as [SourceId, number][]).map(([s, n]) => <SourceTag key={s} source={s} count={n} />)}
            </div>
            {region === "ALL" && (
              <div className="w-24 shrink-0"><RegionSplit IN={metrics.postsIN} GLOBAL={metrics.postsGLOBAL} compactLabel /></div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/** One line per topic, for the niche board. */
export function TopicRow({ topic, region }: { topic: Topic; region: RegionFilter }) {
  const { metrics, heat } = topicIn(topic, region);
  return (
    <Link href={topicHref(topic)} className="group flex items-center gap-3 rounded-xl px-2 py-2 -mx-2 transition-colors hover:bg-hair/[0.04]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.875rem] font-medium group-hover:text-accent">{topic.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span className="num">{metrics.posts} posts</span>
          {metrics.comments > 0 && <span className="num">· {metrics.comments.toLocaleString("en-US")} comments</span>}
          {topic.isNew && <span className="text-accent">· new</span>}
        </p>
      </div>
      <Heat value={heat} size="sm" />
    </Link>
  );
}

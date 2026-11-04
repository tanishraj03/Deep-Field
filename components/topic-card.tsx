"use client";

import Link from "next/link";
import { ArrowBigUp, Eye, Languages, MessageSquare, Users } from "lucide-react";
import { regionWords } from "@/lib/language";
import { nicheLabel } from "@/lib/niches";
import type { RegionFilter, SourceId, Topic } from "@/lib/types";
import { cn, compact } from "@/lib/utils";
import { mentionsOf, topicIn } from "@/lib/view";
import { Badge, Card, Delta, Heat, Metric, RegionSplit, SourceTag, VerdictBadge, ViralityChip } from "./ui";

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

/**
 * "Tamil · trending in India · translated": shown when a topic's threads are
 * mostly not in English, so a translated title never hides where it's from.
 */
export function LanguageLine({ topic, className }: { topic: Topic; className?: string }) {
  if (!topic.language) return null;
  const where = regionWords(topic.metrics.postsIN, topic.metrics.postsGLOBAL);
  return (
    <p className={cn("flex items-center gap-1.5 text-[0.6875rem] text-muted", className)} title={topic.originalTitle ? `Original title: ${topic.originalTitle}` : undefined}>
      <Languages className="h-3.5 w-3.5 shrink-0 text-faint" />
      <span>In {topic.language}{where && ` · ${where}`}{topic.originalTitle && <span className="text-faint"> · translated</span>}</span>
    </p>
  );
}

export function TopicCard({ topic, region, showNiche, rank, className }: { topic: Topic; region: RegionFilter; showNiche?: boolean; rank?: number; className?: string }) {
  const { metrics, heat, virality } = topicIn(topic, region);
  const mentions = mentionsOf(topic, region);
  return (
    <Link href={topicHref(topic)} className={cn("group block h-full", className)}>
      <Card hover className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-faint">
            {(rank !== undefined || showNiche) && (
              <span className="truncate">
                {rank !== undefined && <span className="num font-semibold">#{rank}</span>}
                {rank !== undefined && showNiche && " · "}
                {showNiche && nicheLabel(topic.niche)}
              </span>
            )}
            <Delta isNew={topic.isNew} delta={topic.heatDelta} />
            <VerdictBadge verdict={topic.verdict} />
          </div>
          <Heat value={heat} />
        </div>
        <h3 className="mt-2.5 line-clamp-2 text-[0.975rem] font-semibold leading-snug tracking-tight group-hover:text-accent">
          {topic.title}
        </h3>
        <LanguageLine topic={topic} className="mt-1" />
        {topic.summary && <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">{topic.summary}</p>}
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3">
            <span className="text-xs text-muted" title={`${mentions.threads.toLocaleString("en-US")} posts and comments in the threads${mentions.bluesky ? ` · ${mentions.bluesky.toLocaleString("en-US")}${mentions.capped ? "+" : ""} Bluesky posts` : ""}${mentions.hackernews ? ` · ${mentions.hackernews.toLocaleString("en-US")} on Hacker News` : ""}`}>
              <span className="num font-semibold text-ink">{compact(mentions.total)}{mentions.capped ? "+" : ""}</span> mentions
            </span>
            <ViralityChip value={virality} perHour={metrics.perHour} />
            <Metric icon={MessageSquare} value={metrics.comments} label="comments" />
            <Metric icon={ArrowBigUp} value={metrics.score} label="upvotes" />
            <Metric icon={Eye} value={metrics.views} label="views" />
            <span className="text-xs text-muted"><span className="num font-medium text-ink/80">{metrics.posts}</span> posts</span>
            <Metric icon={Users} value={metrics.communities} label="communities" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-2.5 gap-y-1">
              {(Object.entries(metrics.sources) as [SourceId, number][]).map(([s, n]) => <SourceTag key={s} source={s} count={n} />)}
            </div>
            {region === "ALL" && <RegionSplit IN={metrics.postsIN} GLOBAL={metrics.postsGLOBAL} compactLabel />}
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
          {topic.language && <span>{topic.language} ·</span>}
          <span className="num">{metrics.posts} posts</span>
          {metrics.comments > 0 && <span className="num">· {metrics.comments.toLocaleString("en-US")} comments</span>}
          {topic.isNew && <span className="text-accent">· new</span>}
          {topic.verdict?.call === "make" && <span className="text-rise">· make now</span>}
        </p>
      </div>
      <Heat value={heat} size="sm" />
    </Link>
  );
}

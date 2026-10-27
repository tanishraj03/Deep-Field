"use client";

import Link from "next/link";
import { ArrowLeft, Check, Copy, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { NICHE_BY_ID } from "@/lib/niches";
import type { ContentAngle, NicheScan, Topic } from "@/lib/types";
import { compact, relativeTime, shortQuery } from "@/lib/utils";
import { mentionsOf, postsFor, topicIn } from "@/lib/view";
import { RankBars } from "./charts";
import { PostRow } from "./post-row";
import { useRegion } from "./region";
import { SentimentBadge } from "./topic-card";
import { Badge, Button, Card, Delta, Eyebrow, Heat, REGION_OPTIONS, RegionSplit, Segmented, Stat, VERDICT_META, VerdictBadge } from "./ui";
import { bestCommentByPost, TopComments, useDiscussion, VoicesPanel } from "./voices";

export function AngleCard({ angle }: { angle: ContentAngle }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative rounded-xl bg-hair/[0.04] p-3 pr-9">
      <Badge tone="accent">{angle.format || "Idea"}</Badge>
      <p className="mt-1.5 text-[0.875rem] leading-snug">{angle.hook}</p>
      <button
        aria-label="Copy hook"
        onClick={() => { navigator.clipboard.writeText(angle.hook); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
        className="absolute right-2.5 top-2.5 rounded-md p-1 text-faint opacity-0 transition hover:text-ink group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-rise" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

type Tab = "overview" | "voices";

export function TopicView({ topic, scan }: { topic: Topic; scan: NicheScan }) {
  const { region, setRegion } = useRegion();
  const [tab, setTabState] = useState<Tab>(useSearchParams().get("tab") === "voices" ? "voices" : "overview");
  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, "", t === "voices" ? "?tab=voices" : window.location.pathname);
  };
  const discussion = useDiscussion({ topic: `${topic.niche}:${topic.id}` });
  const best = bestCommentByPost(discussion.data);
  const n = NICHE_BY_ID.get(topic.niche);
  const { metrics, heat, virality } = topicIn(topic, region);
  const mentions = mentionsOf(topic, region);
  const posts = postsFor(topic, scan, region);
  const communities = new Map<string, { label: string; value: number; region: "IN" | "GLOBAL" }>();
  for (const p of postsFor(topic, scan, "ALL")) {
    const c = communities.get(p.community) ?? { label: p.community, value: 0, region: p.region };
    c.value++;
    communities.set(p.community, c);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/?niche=${topic.niche}`} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" />{n?.label ?? topic.niche}
        </Link>
        <Segmented value={region} onChange={setRegion} options={REGION_OPTIONS} layoutId="topic-region" size="sm" />
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">{n?.label}</Badge>
              <SentimentBadge s={topic.sentiment} />
              <Delta isNew={topic.isNew} delta={topic.heatDelta} />
              {topic.groupedBy === "rules" && <Badge tone="outline">grouped by keyword</Badge>}
              <VerdictBadge verdict={topic.verdict} />
            </div>
            <h1 className="mt-3 text-[1.625rem] font-semibold leading-tight tracking-tight">{topic.title}</h1>
            {topic.summary && <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/85">{topic.summary}</p>}
            {topic.whyNow && <p className="mt-2 text-sm text-muted"><span className="font-medium text-ink/80">Why now: </span>{topic.whyNow}</p>}
            {topic.verdict && (
              <div className="mt-4 rounded-xl bg-hair/[0.04] p-3.5">
                <p className="text-sm">
                  <span className={`font-semibold ${{ make: "text-rise", test: "text-ember", skip: "text-muted" }[topic.verdict.call]}`}>
                    {VERDICT_META[topic.verdict.call].label}
                  </span>
                  <span className="num ml-2 text-xs text-faint">{topic.verdict.score}/100</span>
                </p>
                {topic.verdict.reasons.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 text-[0.8125rem] text-muted">
                    {topic.verdict.reasons.map((r) => <li key={r}>· {r}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-6">
            <div className="flex flex-col items-end gap-1">
              <span className="eyebrow">Heat</span>
              <Heat value={heat} size="lg" />
            </div>
            <div className="flex flex-col items-end gap-1" title={`~${compact(metrics.perHour)} reactions an hour`}>
              <span className="eyebrow">Virality</span>
              <Heat value={virality ?? 0} size="lg" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 border-t pt-5 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Mentions" value={`${compact(mentions.total)}${mentions.capped ? "+" : ""}`}
            sub={[mentions.bluesky ? `${compact(mentions.bluesky)}${mentions.capped ? "+" : ""} on Bluesky` : null, mentions.hackernews ? `${compact(mentions.hackernews)} on HN` : null].filter(Boolean).join(" · ") || "posts + comments"} />
          <Stat label="Threads" value={metrics.posts} />
          <Stat label="Comments" value={compact(metrics.comments)} />
          <Stat label="Upvotes" value={compact(metrics.score)} />
          {metrics.views > 0 ? <Stat label="Video views" value={compact(metrics.views)} /> : <Stat label="Communities" value={metrics.communities} />}
          <Stat label="Reactions / hour" value={compact(metrics.perHour)} sub={`${metrics.last24h} new threads in 24h`} />
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <p className="eyebrow mb-2">India vs global</p>
            <RegionSplit IN={topic.metrics.postsIN} GLOBAL={topic.metrics.postsGLOBAL} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/explore?q=${encodeURIComponent(shortQuery(topic.title))}`}>
            <Button variant="secondary"><Search className="h-3.5 w-3.5" />Research across the web</Button>
          </Link>
          <Link href={`/assistant?topic=${topic.niche}:${topic.id}`}>
            <Button variant="primary"><Sparkles className="h-3.5 w-3.5" />Ask the assistant</Button>
          </Link>
        </div>
      </Card>

      <Segmented value={tab} onChange={setTab} layoutId="topic-tab" options={[
        { value: "overview", label: "Overview" },
        { value: "voices", label: "What people are saying" },
      ]} />

      {tab === "voices" ? <VoicesPanel state={discussion} /> : (
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <Eyebrow>The threads · {posts.length}</Eyebrow>
            <span className="text-[0.6875rem] text-faint">scanned {relativeTime(scan.scannedAt)}</span>
          </div>
          {posts.length
            ? posts.map((p) => <PostRow key={p.id} post={p} quote={best.get(p.id)} />)
            : <p className="py-6 text-sm text-muted">No threads in this region — switch to Everywhere.</p>}
        </Card>

        <div className="space-y-4">
          <TopComments state={discussion} onOpenAll={() => setTab("voices")} />
          {topic.angles.length > 0 && (
            <Card className="p-5">
              <Eyebrow className="mb-3">Content angles</Eyebrow>
              <div className="space-y-2">{topic.angles.map((a, i) => <AngleCard key={i} angle={a} />)}</div>
            </Card>
          )}
          {topic.questions.length > 0 && (
            <Card className="p-5">
              <Eyebrow className="mb-3">What people are asking</Eyebrow>
              <ul className="space-y-2.5">
                {topic.questions.map((q) => (
                  <li key={q} className="flex gap-2.5 text-[0.875rem] leading-snug">
                    <span className="mt-0.5 text-accent">?</span>{q}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-5">
            <Eyebrow className="mb-3">Where it&apos;s happening · threads</Eyebrow>
            <RankBars rows={[...communities.values()].sort((a, b) => b.value - a.value).slice(0, 8)} />
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

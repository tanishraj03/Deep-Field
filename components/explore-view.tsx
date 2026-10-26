"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Loader2, RefreshCw, Search, Sparkles, TriangleAlert, X } from "lucide-react";
import type { ExploreInsight, ExploreResult, RegionFilter, SourceId } from "@/lib/types";
import { cn, compact, relativeTime } from "@/lib/utils";
import { DailyBars, RankBars, Sparkline } from "./charts";
import { PostRow } from "./post-row";
import { useRegion } from "./region";
import { SentimentBadge } from "./topic-card";
import { AngleCard } from "./topic-view";
import { Badge, Button, Card, Eyebrow, REGION_OPTIONS, RegionSplit, Segmented, Skeleton, SOURCE_META } from "./ui";
import { bestCommentByPost, TopComments, useDiscussion, VoicesPanel } from "./voices";

const SCANNING = ["Reddit", "Hacker News", "YouTube", "News (GDELT)", "Wikipedia"];

export function ExploreView({ initialQuery, initialRegion, suggestions }: {
  initialQuery: string; initialRegion: RegionFilter | null; suggestions: string[];
}) {
  const router = useRouter();
  const { region, setRegion } = useRegion();
  const [input, setInput] = useState(initialQuery);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insight, setInsight] = useState<ExploreInsight | null>(null);
  const [insightState, setInsightState] = useState<"idle" | "loading" | "error">("idle");
  const [insightError, setInsightError] = useState<string | null>(null);
  const reqId = useRef(0);

  const loadInsight = useCallback(async (q: string, r: RegionFilter) => {
    setInsightState("loading");
    setInsight(null);
    try {
      const res = await fetch("/api/explore/insight", { method: "POST", body: JSON.stringify({ q, region: r }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setInsight(json.insight);
      setInsightState("idle");
    } catch (e) {
      setInsightError((e as Error).message);
      setInsightState("error");
    }
  }, []);

  const search = useCallback(async (q: string, r: RegionFilter, fresh = false) => {
    if (q.trim().length < 2) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    setInsight(null);
    setInsightState("idle");
    router.replace(`/explore?q=${encodeURIComponent(q.trim())}&region=${r}`, { scroll: false });
    try {
      const res = await fetch(`/api/explore?q=${encodeURIComponent(q.trim())}&region=${r}${fresh ? "&fresh=1" : ""}`);
      const json = await res.json();
      if (id !== reqId.current) return;
      if (!json.ok) throw new Error(json.error);
      setResult(json.result);
      if (json.result.posts.length) loadInsight(q.trim(), r);
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [router, loadInsight]);

  // A shared link carries its own region; otherwise use the remembered one.
  useEffect(() => {
    if (initialRegion && initialRegion !== region) setRegion(initialRegion);
    if (initialQuery) search(initialQuery, initialRegion ?? region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRegion = (r: RegionFilter) => {
    setRegion(r);
    if (result) search(result.query, r);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Explore</h1>
        <p className="mt-1 text-sm text-muted">How big is a conversation, where is it happening, and what are people saying — for any topic, this week.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); search(input, region); }}
        className="card flex flex-col gap-2 p-2 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2.5 px-2">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search any topic — ozempic, iPhone 18, Zepto, creatine…"
            className="h-10 w-full bg-transparent text-[0.95rem] outline-none placeholder:text-faint"
            autoFocus={!initialQuery}
          />
          {input && <button type="button" onClick={() => setInput("")} className="text-faint hover:text-ink"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Segmented value={region} onChange={changeRegion} options={REGION_OPTIONS} layoutId="explore-region" size="sm" />
          <Button type="submit" variant="primary" loading={loading}>Search</Button>
        </div>
      </form>

      {!result && !loading && !error && suggestions.length > 0 && (
        <div>
          <Eyebrow className="mb-2">Trending in your Pulse</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => { setInput(s); search(s, region); }}
                className="press rounded-pill bg-hair/[0.05] px-3 py-1.5 text-[0.8125rem] text-muted hover:text-ink">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <Scanning />}
      {error && !loading && (
        <Card className="flex items-center gap-3 p-4 text-sm"><TriangleAlert className="h-4 w-4 text-ember" />{error}</Card>
      )}
      {result && !loading && (
        <Result result={result} insight={insight} insightState={insightState} insightError={insightError}
          onRefresh={() => search(result.query, result.region, true)}
          onRetryInsight={() => loadInsight(result.query, result.region)} />
      )}
    </div>
  );
}

function Scanning() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, SCANNING.length)), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <Card className="p-6">
      <p className="text-sm font-medium">Reading the last week of conversation…</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-5">
        {SCANNING.map((s, i) => (
          <li key={s} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[0.8125rem] transition-colors",
            i < step ? "bg-hair/[0.05] text-ink" : "text-faint")}>
            {i < step ? <Check className="h-3.5 w-3.5 text-rise" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}{s}
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
    </Card>
  );
}

const SOURCE_ORDER: SourceId[] = ["reddit", "hackernews", "news", "youtube", "wikipedia"];

function Result({ result, insight, insightState, insightError, onRefresh, onRetryInsight }: {
  result: ExploreResult; insight: ExploreInsight | null; insightState: "idle" | "loading" | "error"; insightError: string | null;
  onRefresh: () => void; onRetryInsight: () => void;
}) {
  const [filter, setFilter] = useState<SourceId | "all">("all");
  const [tab, setTab] = useState<"threads" | "voices">("threads");
  const discussion = useDiscussion({ q: result.query, region: result.region });
  const best = bestCommentByPost(discussion.data);
  const tabsRef = useRef<HTMLDivElement>(null);
  const openVoices = () => { setTab("voices"); tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const sources = SOURCE_ORDER.map((s) => result.sources.find((x) => x.source === s)).filter((s) => !!s);
  const shown = result.posts.filter((p) => filter === "all" || p.source === filter).slice(0, 40);
  const series = (["reddit", "news", "hackernews", "youtube"] as const).filter((k) => result.daily.some((d) => d[k] > 0));
  const where = result.region === "ALL" ? "everywhere" : result.region === "IN" ? "in India" : "globally";

  return (
    <div className="space-y-4 duration-500 animate-in fade-in slide-in-from-bottom-2">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">This week · {where}</p>
            <h2 className="mt-2 text-[1.5rem] font-semibold leading-tight tracking-tight">
              <span className="num">{result.totals.conversations.toLocaleString("en-US")}</span> conversations about “{result.query}”
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              <span className="num">{compact(result.totals.comments)}</span> comments · <span className="num">{compact(result.totals.score)}</span> upvotes
              {result.totals.views > 0 && <> · <span className="num">{compact(result.totals.views)}</span> video views</>}
              {" "}· searched {relativeTime(result.fetchedAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
            <Link href={`/assistant?q=${encodeURIComponent(result.query)}&region=${result.region}`}>
              <Button size="sm" variant="primary"><Sparkles className="h-3.5 w-3.5" />Dig deeper</Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hair/[0.08] sm:grid-cols-5">
          {sources.map((s) => (
            <div key={s.source} className="bg-surface p-3.5">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_META[s.source].color }} />{SOURCE_META[s.source].label}
              </p>
              {s.ok ? (
                <>
                  <p className="num mt-1.5 text-xl font-semibold">{compact(s.total)}{s.capped ? "+" : ""}</p>
                  <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-faint">
                    {s.source === "wikipedia" ? "page views" : s.source === "news" ? "articles" : s.source === "youtube" ? "top videos" : "posts"} · {s.note ?? s.window}
                  </p>
                </>
              ) : (
                <p className="mt-1.5 line-clamp-3 text-[0.6875rem] text-faint">{s.note ?? "unavailable"}</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Insight insight={insight} state={insightState} error={insightError} onRetry={onRetryInsight} />
        <div className="space-y-4 self-start">
        <Card className="divide-y">
          <div className="p-5">
            <Eyebrow className="mb-3">Conversation per day · by source</Eyebrow>
            {series.length ? (
              <div className="space-y-4">
                {series.map((k) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">{SOURCE_META[k].label}</span>
                      <span className="num text-faint">{result.daily.reduce((a, d) => a + d[k], 0).toLocaleString("en-US")} in 14 days</span>
                    </div>
                    <DailyBars data={result.daily} series={[{ key: k, label: SOURCE_META[k].label, color: "rgb(var(--global))" }]} height={44} />
                  </div>
                ))}
                {result.sources.find((s) => s.source === "reddit")?.capped && (
                  <p className="text-[0.6875rem] text-faint">Reddit per-day is drawn from the top 100 matching threads.</p>
                )}
              </div>
            ) : <p className="text-sm text-muted">No dated conversation found.</p>}
          </div>
          {result.attention && result.attention.daily.length > 1 && (
            <div className="p-5">
              <div className="mb-2 flex items-baseline justify-between">
                <Eyebrow>Attention · Wikipedia views, 30 days</Eyebrow>
                <a href={result.attention.url} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-accent">{result.attention.article}</a>
              </div>
              <Sparkline values={result.attention.daily.map((d) => d.views)} labels={result.attention.daily.map((d) => d.date)} height={64} unit=" views" />
            </div>
          )}
          {(result.regionSplit.IN + result.regionSplit.GLOBAL > 0 || result.communities.length > 0) && (
            <div className="p-5">
              {result.region === "ALL" && result.regionSplit.IN + result.regionSplit.GLOBAL > 0 && (
                <div className="mb-5">
                  <Eyebrow className="mb-2">India vs global · threads found</Eyebrow>
                  <RegionSplit IN={result.regionSplit.IN} GLOBAL={result.regionSplit.GLOBAL} />
                </div>
              )}
              {result.communities.length > 0 && (
                <>
                  <Eyebrow className="mb-3">Top communities</Eyebrow>
                  <RankBars rows={result.communities.slice(0, 8).map((c) => ({ label: c.name, value: c.posts, region: c.region, href: `https://www.reddit.com/${c.name}/` }))} />
                </>
              )}
            </div>
          )}
        </Card>
        <TopComments state={discussion} onOpenAll={openVoices} />
        </div>
      </div>

      <div ref={tabsRef} className="flex scroll-mt-6 flex-wrap items-center justify-between gap-3">
        <Segmented value={tab} onChange={setTab} layoutId="explore-tab" options={[
          { value: "threads", label: <>The conversations <span className="num opacity-60">{result.posts.length}</span></> },
          { value: "voices", label: "What people are saying" },
        ]} />
        {tab === "threads" && (
          <div className="flex flex-wrap gap-1">
            {(["all", ...SOURCE_ORDER] as const).map((s) => {
              const count = s === "all" ? result.posts.length : result.posts.filter((p) => p.source === s).length;
              if (s !== "all" && !count) return null;
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === s ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink")}>
                  {s === "all" ? "All" : SOURCE_META[s].label} <span className="num opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {tab === "voices" ? <VoicesPanel state={discussion} /> : (
        <Card className="p-5">
          {shown.length ? shown.map((p) => <PostRow key={p.id} post={p} quote={best.get(p.id)} />) : <p className="py-6 text-sm text-muted">Nothing found for this filter.</p>}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Where we can&apos;t count, look for yourself:</span>
        {result.links.map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-pill bg-hair/[0.05] px-2.5 py-1 hover:text-ink">
            {l.label}<ArrowUpRight className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

function Insight({ insight, state, error, onRetry }: {
  insight: ExploreInsight | null; state: "idle" | "loading" | "error"; error: string | null; onRetry: () => void;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" />What&apos;s being said</Eyebrow>
        {insight && <span className="text-[0.6875rem] text-faint">AI read · {insight.model}</span>}
      </div>
      {state === "loading" && (
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-4 h-16" /><Skeleton className="h-16" />
          </div>
        )}
        {state === "error" && (
          <div className="text-sm text-muted">
            <p>{error}</p>
            <Button size="sm" className="mt-3" onClick={onRetry}>Try again</Button>
          </div>
        )}
        {insight && state === "idle" && (
          <div className="space-y-5 duration-500 animate-in fade-in">
            <p className="text-[0.95rem] leading-relaxed">{insight.summary}</p>
            {insight.verdict && (
              <div className="rounded-xl bg-accent/[0.07] p-3.5 text-[0.875rem] leading-relaxed">
                <span className="font-semibold text-accent">Verdict · </span>{insight.verdict}
              </div>
            )}
            {insight.threads.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Inside the conversation</p>
                <ul className="space-y-2.5">
                  {insight.threads.map((t) => (
                    <li key={t.title} className="text-[0.875rem] leading-snug">
                      <span className="font-medium">{t.title}</span> <span className="text-muted">— {t.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-start gap-2 text-[0.875rem]">
              <SentimentBadge s={insight.sentiment.label} /><span className="text-muted">{insight.sentiment.detail}</span>
            </div>
            {insight.questions.length > 0 && (
              <div>
                <p className="eyebrow mb-2">What people are asking</p>
                <ul className="space-y-1.5">
                  {insight.questions.map((q) => <li key={q} className="flex gap-2 text-[0.875rem]"><span className="text-accent">?</span>{q}</li>)}
                </ul>
              </div>
            )}
            {insight.angles.length > 0 && (
              <div>
                <p className="eyebrow mb-2">Content angles</p>
                <div className="grid gap-2 sm:grid-cols-2">{insight.angles.map((a, i) => <AngleCard key={i} angle={a} />)}</div>
              </div>
            )}
          </div>
        )}
        {!insight && state === "idle" && <Badge tone="outline">No conversation to interpret</Badge>}
    </Card>
  );
}

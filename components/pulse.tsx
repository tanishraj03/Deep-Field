"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Radar, RefreshCw, TriangleAlert } from "lucide-react";
import { NICHE_BY_ID, NICHES } from "@/lib/niches";
import type { FeedPrefs } from "@/lib/prefs";
import type { NicheScan, RegionFilter, Signal, SignalsScan, SourceId } from "@/lib/types";
import { compact, relativeTime } from "@/lib/utils";
import { mentionsOf, rankTopics, topicIn, visibleTopics, volumeRows, weeklyPosts, type RankBy } from "@/lib/view";
import { DailyBars, RankBars, Sparkline } from "./charts";
import { useRegion } from "./region";
import { ScanAllButton, ScanProgressPanel, useScanRunner } from "./scan-runner";
import { TopicCard, TopicRow } from "./topic-card";
import { Button, Card, EmptyState, Eyebrow, REGION_OPTIONS, Segmented, SOURCE_META, Stat } from "./ui";

const STALE_MS = 6 * 60 * 60_000;

export function PulseView({ scans, signals, initialNiche, prefs }: {
  scans: NicheScan[]; signals: SignalsScan | null; initialNiche: string | null; prefs: FeedPrefs;
}) {
  const { region, setRegion } = useRegion();
  const [niche, setNicheState] = useState<string | null>(initialNiche && NICHE_BY_ID.has(initialNiche) ? initialNiche : null);
  const setNiche = (id: string | null) => {
    setNicheState(id);
    window.history.replaceState(null, "", id ? `/?niche=${id}` : "/");
  };
  const byNiche = useMemo(() => new Map(scans.map((s) => [s.niche, s])), [scans]);
  const { progress, run } = useScanRunner();
  const [rankBy, setRankBy] = useState<RankBy>(prefs.rankBy ?? "heat");
  const mine = useMemo(() => new Set(prefs.niches.filter((id) => NICHE_BY_ID.has(id))), [prefs.niches]);
  const rankSwitch = (
    <Segmented value={rankBy} onChange={setRankBy} layoutId="pulse-rank" size="sm" options={[
      { value: "heat", label: "Heat" },
      { value: "virality", label: "Virality" },
    ]} />
  );

  const missing = NICHES.filter((n) => !byNiche.has(n.id)).map((n) => n.id);
  const stale = NICHES.filter((n) => {
    const s = byNiche.get(n.id);
    return !s || Date.now() - Date.parse(s.scannedAt) > STALE_MS;
  }).map((n) => n.id);
  const lastScan = scans.reduce<string | null>((a, s) => (!a || s.scannedAt > a ? s.scannedAt : a), null);

  if (!scans.length) {
    return (
      <div className="space-y-6">
        <Header region={region} setRegion={setRegion} lastScan={null} />
        <EmptyState
          icon={Radar}
          title="Nothing scanned yet"
          body={<>The first scan reads {NICHES.length} niches across Reddit, Hacker News, YouTube and the open web, then groups what it finds into conversations. It takes a few minutes; results appear niche by niche as they land.</>}
          action={
            <div className="flex flex-col items-center gap-3">
              <Button variant="primary" loading={progress.running} onClick={() => run(NICHES.map((n) => n.id), { signals: true })}>
                {progress.running ? `Scanning ${progress.current}…` : "Run the first scan"}
              </Button>
              <ScanProgressPanel progress={progress} />
            </div>
          }
        />
      </div>
    );
  }

  const selected = niche ? byNiche.get(niche) ?? null : null;

  return (
    <div className="space-y-7">
      <Header
        region={region} setRegion={setRegion} lastScan={lastScan}
        // Older scans did not record it; a partial sum would understate the reach.
        read={scans.filter((s) => s.postsRead).length >= scans.length / 2 ? scans.reduce((a, s) => a + (s.postsRead ?? 0), 0) : undefined}
        action={<ScanAllButton stale={stale} size="sm" label={stale.length ? `Refresh ${stale.length === NICHES.length ? "all" : `${stale.length} stale`}` : "Rescan all"} />}
      />

      <Kpis scans={scans} region={region} />

      <NichePills niche={niche} setNiche={setNiche} scans={byNiche} region={region} mine={mine} />

      {niche ? (
        selected
          ? <NicheDetail scan={selected} region={region} rankBy={rankBy} rankSwitch={rankSwitch} spiking={signals && <SpikingNow signals={signals} region={region} niche={niche} />} />
          : (
            <EmptyState
              icon={Radar}
              title={`${NICHE_BY_ID.get(niche)?.label} hasn't been scanned yet`}
              body="Scan it now. It takes about a minute."
              action={<Button variant="primary" loading={progress.running} onClick={() => run([niche])}>Scan this niche</Button>}
            />
          )
      ) : (
        <Overview scans={scans} region={region} setNiche={setNiche} missing={missing} rankBy={rankBy} rankSwitch={rankSwitch} mine={mine}
          spiking={signals && <SpikingNow signals={signals} region={region} niche={null} />} />
      )}
    </div>
  );
}

function Header({ region, setRegion, lastScan, read, action }: {
  region: RegionFilter; setRegion: (r: RegionFilter) => void; lastScan: string | null; read?: number; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Pulse</h1>
        <p className="mt-1 text-sm text-muted">
          What the internet is talking about right now{lastScan ? <> · updated {relativeTime(lastScan)}</> : null}
          {read ? <> · <span className="num">{compact(read)}</span> posts read</> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <Segmented value={region} onChange={setRegion} options={REGION_OPTIONS} layoutId="pulse-region" />
        {action}
      </div>
    </div>
  );
}

function Kpis({ scans, region }: { scans: NicheScan[]; region: RegionFilter }) {
  const topics = scans.flatMap((s) => visibleTopics(s, region));
  const views = topics.map((t) => topicIn(t, region));
  const posts = views.reduce((a, v) => a + v.metrics.posts, 0);
  const comments = views.reduce((a, v) => a + v.metrics.comments, 0);
  const reach = views.reduce((a, v) => a + v.metrics.views, 0);
  const mentions = topics.map((t) => mentionsOf(t, region));
  const totalMentions = mentions.reduce((a, m) => a + m.total, 0);
  const webMentions = mentions.reduce((a, m) => a + m.bluesky + m.hackernews, 0);
  const weekly = scans.reduce((a, s) => a + weeklyPosts(s, region), 0);
  const rising = topics.filter((t) => (t.heatDelta ?? 0) > 0 || t.isNew).length;
  const makeNow = topics.filter((t) => t.verdict?.call === "make").length;
  const hottest = [...topics].sort((a, b) => topicIn(b, region).heat - topicIn(a, region).heat)[0];

  return (
    <div className="grid grid-cols-2 gap-y-5 border-y py-4 md:grid-cols-5 md:divide-x md:divide-hair/10 [&>*]:md:px-5 [&>*:first-child]:md:pl-0">
      <Stat label="Mentions" value={compact(totalMentions)}
        sub={<span title="Every post and comment in the grouped threads, plus matching posts on Bluesky and stories and comments on Hacker News this week. Platform counts only.">
          <span className="num">{compact(posts)}</span> threads · <span className="num">{compact(comments)}</span> comments{webMentions ? <> · <span className="num">{compact(webMentions)}</span> web posts</> : null}
        </span>} />
      <Stat label="Reach" value={compact(reach)} sub="video views on these topics" />
      <Stat label="Topics" value={compact(topics.length)} sub={<><span className="num text-rise">{makeNow}</span> worth making now</>} />
      <Stat label="Posts this week" value={compact(weekly)} sub={`across ${scans.reduce((a, s) => a + s.communities.filter((c) => region === "ALL" || c.region === region).length, 0)} tracked communities`} />
      <Stat
        label="Rising or new"
        value={rising}
        sub={hottest ? <span className="line-clamp-1">Hottest: {hottest.title}</span> : "None yet"}
      />
    </div>
  );
}

function SpikingNow({ signals, region, niche }: { signals: SignalsScan; region: RegionFilter; niche: string | null }) {
  const list = signals.signals
    .filter((s) => region === "ALL" || s.region === region)
    .filter((s) => !niche || s.niche === niche);
  // Interleave sources so one feed cannot fill the strip.
  const bySource = new Map<SourceId, Signal[]>();
  for (const s of [...list].sort((a, b) => b.value - a.value)) (bySource.get(s.source) ?? bySource.set(s.source, []).get(s.source)!).push(s);
  const mixed: Signal[] = [];
  for (let i = 0; mixed.length < 24 && i < 30; i++) for (const arr of bySource.values()) if (arr[i]) mixed.push(arr[i]);
  if (!mixed.length) return null;

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <Eyebrow>Spiking now · searches, lookups and trending tags</Eyebrow>
        <span className="text-[0.6875rem] text-faint">updated {relativeTime(signals.scannedAt)}</span>
      </div>
      <div className="fade-edge-r no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {mixed.map((s) => (
          <a key={s.id} href={s.url} target="_blank" rel="noreferrer"
            className="card card-hover group flex w-56 shrink-0 flex-col p-3">
            <span className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: SOURCE_META[s.source].color }} />
              {SOURCE_META[s.source].label}{s.region === "IN" ? " · India" : ""}
              <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="mt-1.5 line-clamp-1 text-[0.875rem] font-medium">{s.title}</span>
            <span className="num mt-0.5 line-clamp-1 text-xs text-muted">{s.measure}</span>
            {s.context && <span className="mt-1 line-clamp-1 text-[0.6875rem] text-faint">{s.context}</span>}
          </a>
        ))}
      </div>
    </section>
  );
}

/**
 * The niche row. Your niches come first, marked with a dot. It scrolls
 * sideways; arrows at the ends say there is more and scroll a page at a time.
 */
function NichePills({ niche, setNiche, scans, region, mine }: {
  niche: string | null; setNiche: (n: string | null) => void; scans: Map<string, NicheScan>; region: RegionFilter; mine: Set<string>;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  // Bring the selected niche into view, e.g. when arriving from a link.
  useEffect(() => {
    row.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [niche]);
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.75, behavior: "smooth" });

  const ordered = [...NICHES.filter((n) => mine.has(n.id)), ...NICHES.filter((n) => !mine.has(n.id))];
  const pill = (id: string | null, label: string, count?: number, yours?: boolean) => (
    <button
      key={id ?? "all"}
      onClick={() => setNiche(id)}
      aria-pressed={niche === id}
      title={yours ? "One of your niches" : undefined}
      className={`press relative shrink-0 rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${niche === id ? "text-canvas" : "text-muted hover:text-ink bg-hair/[0.05]"}`}
    >
      {niche === id && <motion.span layoutId="niche-pill" className="absolute inset-0 rounded-pill bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
      <span className="relative flex items-center">
        {yours && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
        {label}{count !== undefined && <span className="num ml-1.5 opacity-60">{count}</span>}
      </span>
    </button>
  );
  const arrow = (dir: 1 | -1) => (
    <button
      onClick={() => scroll(dir)}
      aria-label={dir === 1 ? "Scroll niches right" : "Scroll niches left"}
      className={`press absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted shadow-sm ring-1 ring-hair/10 transition hover:text-ink ${dir === 1 ? "right-0" : "left-0"}`}
    >
      {dir === 1 ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
    </button>
  );
  return (
    <div className="relative">
      <div
        ref={row}
        onScroll={measure}
        className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1"
        style={{
          maskImage: `linear-gradient(90deg, ${edges.left ? "transparent, #000 48px" : "#000"}, ${edges.right ? "#000 calc(100% - 56px), transparent" : "#000"})`,
        }}
      >
        {pill(null, "All niches")}
        {ordered.map((n, i) => {
          const s = scans.get(n.id);
          const p = pill(n.id, n.label, s ? visibleTopics(s, region).length : undefined, mine.has(n.id));
          // A hairline between your niches and the rest.
          return mine.size > 0 && i === mine.size
            ? [<span key="divider" aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-hair/15" />, p]
            : p;
        })}
      </div>
      {edges.left && arrow(-1)}
      {edges.right && arrow(1)}
    </div>
  );
}

const BOARD_PREVIEW = 9;

function Overview({ scans, region, setNiche, missing, spiking, rankBy, rankSwitch, mine }: {
  scans: NicheScan[]; region: RegionFilter; setNiche: (n: string) => void; missing: string[]; spiking: React.ReactNode;
  rankBy: RankBy; rankSwitch: React.ReactNode; mine: Set<string>;
}) {
  const [showAll, setShowAll] = useState(false);
  // "Hottest" opens on your niches when you picked some and they have anything to show.
  const yours = scans.filter((s) => mine.has(s.niche)).flatMap((s) => visibleTopics(s, region));
  const [scope, setScope] = useState<"mine" | "all">(yours.length ? "mine" : "all");
  const pool = scope === "mine" && yours.length ? yours : scans.flatMap((s) => visibleTopics(s, region));
  const hottest = rankTopics(pool, region, rankBy).slice(0, 6);

  const board = scans
    .map((s) => ({ s, topics: visibleTopics(s, region) }))
    .filter((x) => x.topics.length)
    .sort((a, b) =>
      Number(mine.has(b.s.niche)) - Number(mine.has(a.s.niche)) ||
      b.topics.slice(0, 3).reduce((x, t) => x + topicIn(t, region).heat, 0) -
      a.topics.slice(0, 3).reduce((x, t) => x + topicIn(t, region).heat, 0));

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[1.05rem] font-semibold tracking-tight">
            {rankBy === "heat" ? "Hottest conversations" : "Most viral conversations"}{scope === "mine" && yours.length ? " in your niches" : ""}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {yours.length > 0 && (
              <Segmented value={scope} onChange={setScope} layoutId="pulse-scope" size="sm" options={[
                { value: "mine", label: "Your niches" },
                { value: "all", label: "All" },
              ]} />
            )}
            {rankSwitch}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {hottest.map((t, i) => <TopicCard key={t.id} topic={t} region={region} showNiche rank={i + 1} />)}
        </div>
      </section>

      {spiking}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[1.05rem] font-semibold tracking-tight">Every niche at a glance</h2>
          {missing.length > 0 && <span className="text-xs text-faint">{missing.length} niches not scanned yet</span>}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(showAll ? board : board.slice(0, BOARD_PREVIEW)).map(({ s, topics }) => {
            const n = NICHE_BY_ID.get(s.niche)!;
            const rows = volumeRows(s, region);
            const series = rows.map((r) => r.IN + r.GLOBAL);
            return (
              <Card key={s.niche} className="flex flex-col p-4">
                <button onClick={() => setNiche(s.niche)} className="group flex items-start justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight group-hover:text-accent">{n.label}</p>
                    <p className="num mt-0.5 text-xs text-muted">
                      {s.dailyVolume.length ? `${compact(weeklyPosts(s, region))} posts this week` : "volume unavailable"} · {topics.length} topics
                    </p>
                  </div>
                  <Sparkline values={series} labels={rows.map((r) => r.date)} className="w-24 shrink-0" height={30} color="rgb(var(--ink) / 0.55)" />
                </button>
                <div className="mt-3 flex-1">
                  {topics.slice(0, 3).map((t) => <TopicRow key={t.id} topic={t} region={region} />)}
                </div>
                <button onClick={() => setNiche(s.niche)} className="mt-2 flex items-center gap-1 self-start text-xs font-medium text-muted hover:text-accent">
                  All {topics.length} topics <ArrowRight className="h-3 w-3" />
                </button>
              </Card>
            );
          })}
        </div>
        {board.length > BOARD_PREVIEW && (
          <div className="mt-4 flex justify-center">
            <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer niches" : `Show all ${board.length} niches`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function NicheDetail({ scan, region, spiking, rankBy, rankSwitch }: {
  scan: NicheScan; region: RegionFilter; spiking: React.ReactNode; rankBy: RankBy; rankSwitch: React.ReactNode;
}) {
  const n = NICHE_BY_ID.get(scan.niche)!;
  const topics = visibleTopics(scan, region, rankBy);
  const { progress, run } = useScanRunner();
  const rows = volumeRows(scan, region);
  const communities = scan.communities
    .filter((c) => region === "ALL" || c.region === region)
    .sort((a, b) => b.postsWeek - a.postsWeek);
  const failing = scan.sources.filter((s) => !s.ok || s.note);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.25rem] font-semibold tracking-tight">{n.label}</h2>
              <p className="mt-0.5 text-sm text-muted">{n.blurb}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button size="sm" loading={progress.running} onClick={() => run([scan.niche])}>
                {!progress.running && <RefreshCw className="h-3.5 w-3.5" />}Rescan
              </Button>
              <span className="text-[0.6875rem] text-faint">scanned {relativeTime(scan.scannedAt)}</span>
            </div>
          </div>
          <p className="eyebrow mt-5">Posts per day across tracked communities</p>
          <DailyBars
            className="mt-2"
            data={rows}
            series={[
              ...(region !== "GLOBAL" ? [{ key: "IN", label: "India", color: "rgb(var(--india))" }] : []),
              ...(region !== "IN" ? [{ key: "GLOBAL", label: "Global", color: "rgb(var(--global))" }] : []),
            ]}
          />
        </Card>
        <Card className="p-5">
          <p className="eyebrow mb-3">Where the conversation happens · posts this week</p>
          <RankBars rows={communities.slice(0, 8).map((c) => ({ label: c.name, value: c.postsWeek, region: c.region, href: `https://www.reddit.com/${c.name}/` }))} />
        </Card>
      </div>

      {(failing.length > 0 || scan.aiNote) && (
        <details className="group text-xs text-muted">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 hover:text-ink [&::-webkit-details-marker]:hidden">
            <TriangleAlert className="h-3.5 w-3.5 text-ember" />
            {failing.length + (scan.aiNote ? 1 : 0)} scan {failing.length + (scan.aiNote ? 1 : 0) === 1 ? "note" : "notes"}
            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-2 space-y-1 pl-5">
            {scan.aiNote && <li>{scan.aiNote}</li>}
            {failing.map((s) => <li key={s.source}><span className="text-ink/80">{s.source}:</span> {s.note ?? "unavailable"}</li>)}
          </ul>
        </details>
      )}

      {topics.length > 1 && <div className="flex justify-end">{rankSwitch}</div>}
      {topics.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((t, i) => <TopicCard key={t.id} topic={t} region={region} rank={i + 1} />)}
        </div>
      ) : (
        <EmptyState icon={Radar} title="No conversations in this region" body="Switch the region filter to see what the rest of the internet is saying." />
      )}

      {spiking}

      <p className="text-center text-xs text-faint">
        Grouped by {scan.model ?? "shared keywords"} · {scan.communities.length} communities read · <Link href="/settings" className="underline-offset-2 hover:underline">how this works</Link>
      </p>
    </div>
  );
}

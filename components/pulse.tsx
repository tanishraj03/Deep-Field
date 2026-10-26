"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, Radar, RefreshCw, TriangleAlert } from "lucide-react";
import { NICHE_BY_ID, NICHES } from "@/lib/niches";
import type { NicheScan, RegionFilter, Signal, SignalsScan, SourceId } from "@/lib/types";
import { compact, relativeTime } from "@/lib/utils";
import { topicIn, visibleTopics, volumeRows, weeklyPosts } from "@/lib/view";
import { DailyBars, RankBars, Sparkline } from "./charts";
import { useRegion } from "./region";
import { ScanAllButton, ScanProgressPanel, useScanRunner } from "./scan-runner";
import { TopicCard, TopicRow } from "./topic-card";
import { Badge, Button, Card, EmptyState, Eyebrow, REGION_OPTIONS, Segmented, SOURCE_META, Stat } from "./ui";

const STALE_MS = 6 * 60 * 60_000;

export function PulseView({ scans, signals, initialNiche }: { scans: NicheScan[]; signals: SignalsScan | null; initialNiche: string | null }) {
  const { region, setRegion } = useRegion();
  const [niche, setNicheState] = useState<string | null>(initialNiche && NICHE_BY_ID.has(initialNiche) ? initialNiche : null);
  const setNiche = (id: string | null) => {
    setNicheState(id);
    window.history.replaceState(null, "", id ? `/?niche=${id}` : "/");
  };
  const byNiche = useMemo(() => new Map(scans.map((s) => [s.niche, s])), [scans]);
  const { progress, run } = useScanRunner();

  const missing = NICHES.filter((n) => !byNiche.has(n.id)).map((n) => n.id);
  const stale = NICHES.filter((n) => {
    const s = byNiche.get(n.id);
    return !s || Date.now() - Date.parse(s.scannedAt) > STALE_MS;
  }).map((n) => n.id);
  const lastScan = scans.reduce<string | null>((a, s) => (!a || s.scannedAt > a ? s.scannedAt : a), null);

  if (!scans.length) {
    return (
      <div className="space-y-6">
        <Header region={region} setRegion={setRegion} lastScan={null} count={0} />
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
        count={scans.reduce((a, s) => a + visibleTopics(s, region).length, 0)}
        action={<ScanAllButton stale={stale} size="sm" label={stale.length ? `Refresh ${stale.length === NICHES.length ? "all" : `${stale.length} stale`}` : "Rescan all"} />}
      />

      <Kpis scans={scans} region={region} />

      {signals && <SpikingNow signals={signals} region={region} niche={niche} />}

      <NichePills niche={niche} setNiche={setNiche} scans={byNiche} region={region} />

      {niche ? (
        selected
          ? <NicheDetail scan={selected} region={region} />
          : (
            <EmptyState
              icon={Radar}
              title={`${NICHE_BY_ID.get(niche)?.label} hasn't been scanned yet`}
              body="Scan it now — it takes about thirty seconds."
              action={<Button variant="primary" loading={progress.running} onClick={() => run([niche])}>Scan this niche</Button>}
            />
          )
      ) : (
        <Overview scans={scans} region={region} setNiche={setNiche} missing={missing} />
      )}
    </div>
  );
}

function Header({ region, setRegion, lastScan, count, action }: {
  region: RegionFilter; setRegion: (r: RegionFilter) => void; lastScan: string | null; count: number; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Pulse</h1>
        <p className="mt-1 text-sm text-muted">
          What the internet is talking about right now{lastScan ? <> · <span className="num">{count}</span> conversations · updated {relativeTime(lastScan)}</> : null}
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
  const weekly = scans.reduce((a, s) => a + weeklyPosts(s, region), 0);
  const rising = topics.filter((t) => (t.heatDelta ?? 0) > 0 || t.isNew).length;
  const hottest = [...topics].sort((a, b) => topicIn(b, region).heat - topicIn(a, region).heat)[0];

  return (
    <Card className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-4">
      <Stat label="Conversations" value={compact(topics.length)} sub={<><span className="num">{compact(posts)}</span> threads grouped into topics</>} />
      <Stat label="Comments measured" value={compact(comments)} sub="as reported by each platform" />
      <Stat label="Posts this week" value={compact(weekly)} sub={`across ${scans.reduce((a, s) => a + s.communities.filter((c) => region === "ALL" || c.region === region).length, 0)} tracked communities`} />
      <Stat
        label="Rising or new"
        value={rising}
        sub={hottest ? <span className="line-clamp-1">Hottest: {hottest.title}</span> : "—"}
      />
    </Card>
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

function NichePills({ niche, setNiche, scans, region }: {
  niche: string | null; setNiche: (n: string | null) => void; scans: Map<string, NicheScan>; region: RegionFilter;
}) {
  const pill = (id: string | null, label: string, count?: number) => (
    <button
      key={id ?? "all"}
      onClick={() => setNiche(id)}
      className={`press relative shrink-0 rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${niche === id ? "text-canvas" : "text-muted hover:text-ink bg-hair/[0.05]"}`}
    >
      {niche === id && <motion.span layoutId="niche-pill" className="absolute inset-0 rounded-pill bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
      <span className="relative">{label}{count !== undefined && <span className="num ml-1.5 opacity-60">{count}</span>}</span>
    </button>
  );
  return (
    <div className="fade-edge-r no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {pill(null, "All niches")}
      {NICHES.map((n) => {
        const s = scans.get(n.id);
        return pill(n.id, n.label, s ? visibleTopics(s, region).length : undefined);
      })}
    </div>
  );
}

function Overview({ scans, region, setNiche, missing }: {
  scans: NicheScan[]; region: RegionFilter; setNiche: (n: string) => void; missing: string[];
}) {
  const hottest = scans
    .flatMap((s) => visibleTopics(s, region))
    .sort((a, b) => topicIn(b, region).heat - topicIn(a, region).heat)
    .slice(0, 6);

  const board = scans
    .map((s) => ({ s, topics: visibleTopics(s, region) }))
    .filter((x) => x.topics.length)
    .sort((a, b) =>
      b.topics.slice(0, 3).reduce((x, t) => x + topicIn(t, region).heat, 0) -
      a.topics.slice(0, 3).reduce((x, t) => x + topicIn(t, region).heat, 0));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-[1.05rem] font-semibold tracking-tight">Hottest conversations</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {hottest.map((t, i) => <TopicCard key={t.id} topic={t} region={region} showNiche rank={i + 1} />)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[1.05rem] font-semibold tracking-tight">Every niche at a glance</h2>
          {missing.length > 0 && <span className="text-xs text-faint">{missing.length} niches not scanned yet</span>}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {board.map(({ s, topics }) => {
            const n = NICHE_BY_ID.get(s.niche)!;
            const rows = volumeRows(s, region);
            const series = rows.map((r) => r.IN + r.GLOBAL);
            return (
              <Card key={s.niche} className="flex flex-col p-4">
                <button onClick={() => setNiche(s.niche)} className="group flex items-start justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="font-semibold tracking-tight group-hover:text-accent">{n.label}</p>
                    <p className="num mt-0.5 text-xs text-muted">
                      {s.dailyVolume.length ? `${compact(weeklyPosts(s, region))} posts this week` : "volume unavailable"} · {topics.length} conversations
                    </p>
                  </div>
                  <Sparkline values={series} labels={rows.map((r) => r.date)} className="w-24 shrink-0" height={30} color="rgb(var(--ink) / 0.55)" />
                </button>
                <div className="mt-3 flex-1">
                  {topics.slice(0, 4).map((t) => <TopicRow key={t.id} topic={t} region={region} />)}
                </div>
                <button onClick={() => setNiche(s.niche)} className="mt-2 flex items-center gap-1 self-start text-xs font-medium text-muted hover:text-accent">
                  All {topics.length} conversations <ArrowRight className="h-3 w-3" />
                </button>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function NicheDetail({ scan, region }: { scan: NicheScan; region: RegionFilter }) {
  const n = NICHE_BY_ID.get(scan.niche)!;
  const topics = visibleTopics(scan, region);
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
        <div className="flex flex-wrap gap-2">
          {scan.aiNote && <Badge tone="outline"><TriangleAlert className="h-3 w-3" />{scan.aiNote}</Badge>}
          {failing.map((s) => <Badge key={s.source} tone="outline"><TriangleAlert className="h-3 w-3" />{s.source}: {s.note ?? "unavailable"}</Badge>)}
        </div>
      )}

      {topics.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topics.map((t, i) => <TopicCard key={t.id} topic={t} region={region} rank={i + 1} />)}
        </div>
      ) : (
        <EmptyState icon={Radar} title="No conversations in this region" body="Switch the region filter to see what the rest of the internet is saying." />
      )}

      <p className="text-center text-xs text-faint">
        Grouped by {scan.model ?? "shared keywords"} · {scan.communities.length} communities read · <Link href="/sources" className="underline-offset-2 hover:underline">how this works</Link>
      </p>
    </div>
  );
}

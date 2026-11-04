"use client";

import { useState } from "react";
import { ExternalLink, Users } from "lucide-react";
import { NICHE_BY_ID, NICHES } from "@/lib/niches";
import type { Creator, CreatorPlatform, RegionCode } from "@/lib/types";
import { cn, compact, relativeTime } from "@/lib/utils";
import { useRegion } from "./region";
import { Card, EmptyState, Flag, REGION_OPTIONS, Segmented, SOURCE_META } from "./ui";

const PLATFORMS: { id: CreatorPlatform; label: string; reach: string; posts: [string, string]; followers: string | null }[] = [
  { id: "youtube", label: "YouTube", reach: "views", posts: ["trending video", "trending videos"], followers: "subscribers" },
  { id: "reddit", label: "Reddit", reach: "upvotes and comments", posts: ["post", "posts"], followers: null },
];

function Avatar({ c }: { c: Creator }) {
  if (c.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.avatar} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full bg-hair/10 object-cover" />;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase text-white"
      style={{ background: SOURCE_META[c.platform].color }}>
      {c.name.replace(/^u\//, "")[0]}
    </span>
  );
}

function Column({ title, region, list, platform }: { title: string; region: RegionCode; list: Creator[]; platform: (typeof PLATFORMS)[number] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted"><Flag region={region} />{title}</p>
      {list.length ? (
        <ol className="divide-y divide-hair/[0.06]">
          {list.map((c, i) => (
            <li key={c.id} className="flex items-start gap-3 py-2.5">
              <span className="num w-4 shrink-0 pt-2 text-right text-xs text-faint">{i + 1}</span>
              <Avatar c={c} />
              <div className="min-w-0 flex-1">
                <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-[0.875rem] font-medium hover:text-accent">
                  <span className="truncate">{c.name}</span>
                  {c.followers !== null && platform.followers && <span className="num shrink-0 text-xs font-normal text-faint">· {compact(c.followers)} {platform.followers}</span>}
                </a>
                <p className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                  <span>{compact(c.reach)} {platform.reach} · {c.posts} {c.posts === 1 ? platform.posts[0] : platform.posts[1]}</span>
                  {c.breakout !== null && c.breakout >= 3 && (
                    <span className="rounded-pill bg-ember/10 px-1.5 py-px text-[0.625rem] font-semibold text-ember" title={`${c.breakout.toFixed(1)}× their subscriber count in views`}>
                      Viral · {c.breakout >= 10 ? Math.round(c.breakout) : c.breakout.toFixed(1)}× subs
                    </span>
                  )}
                </p>
                <a href={c.top.url} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-[0.6875rem] text-faint hover:text-ink">
                  <span className="truncate">{c.top.title}</span><ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <span className="flex shrink-0 flex-col items-end pt-1" title="DeepField creator score, 0–100">
                <span className={cn("num text-sm font-semibold leading-none", (c.score ?? 0) >= 75 ? "text-ember" : "")}>{c.score ?? "–"}</span>
                <span className="mt-1 h-1 w-8 overflow-hidden rounded-pill bg-hair/10">
                  <span className="block h-full rounded-pill" style={{ width: `${c.score ?? 0}%`, background: (c.score ?? 0) >= 75 ? "rgb(var(--ember))" : "rgb(var(--ink) / 0.5)" }} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-4 text-xs text-faint">Nobody stood out here this week.</p>
      )}
    </div>
  );
}

/**
 * Who is behind what's taking off in a niche: YouTube channels by views on
 * this week's trending videos, Reddit posters by upvotes and comments, India
 * and global. Indian means the channel says it's based in India (or posts in
 * an Indian language); YouTube's global list keeps to English videos.
 */
type Period = "week" | "month";

export function CreatorsView({ byNiche, initialNiche, mine }: {
  byNiche: Record<string, { week: Creator[]; month: Creator[]; since: string | null; scannedAt: string }>;
  initialNiche: string | null;
  mine: string[];
}) {
  const { region, setRegion } = useRegion();
  const ordered = [...NICHES.filter((n) => mine.includes(n.id)), ...NICHES.filter((n) => !mine.includes(n.id))];
  const [niche, setNicheState] = useState(initialNiche && NICHE_BY_ID.has(initialNiche) ? initialNiche : ordered[0].id);
  const setNiche = (id: string) => {
    setNicheState(id);
    window.history.replaceState(null, "", `/creators?niche=${id}`);
  };
  const [period, setPeriod] = useState<Period>("week");
  const data = byNiche[niche];
  const creators = (period === "week" ? data?.week : data?.month) ?? [];
  // The month view is built up from daily scans; say how much of a month it covers so far.
  const covered = data?.since ? Math.max(1, Math.round((Date.now() - Date.parse(data.since)) / 86_400_000)) : 0;
  const regions = (region === "ALL" ? ["IN", "GLOBAL"] : [region]) as RegionCode[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight">Creators</h1>
          <p className="mt-1 text-sm text-muted">
            Who&apos;s behind what&apos;s taking off in each niche {period === "week" ? "this week" : "over the last month"}{data ? <> · updated {relativeTime(data.scannedAt)}</> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented value={period} onChange={setPeriod} layoutId="creators-period" options={[
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
          ]} />
          <Segmented value={region} onChange={setRegion} options={REGION_OPTIONS} layoutId="creators-region" />
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ordered.map((n) => (
          <button key={n.id} onClick={() => setNiche(n.id)} aria-pressed={niche === n.id}
            className={cn("press shrink-0 rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
              niche === n.id ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink")}>
            {mine.includes(n.id) && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" aria-hidden />}
            {n.label}
          </button>
        ))}
      </div>

      {period === "month" && creators.length > 0 && covered < 28 && (
        <p className="-mt-2 text-xs text-faint">
          This month so far covers {covered} {covered === 1 ? "day" : "days"}: DeepField keeps a 30-day record of every creator its daily scans see, so this fills in over the coming weeks.
        </p>
      )}
      {!creators.length ? (
        <EmptyState icon={Users} title={`No creators for ${NICHE_BY_ID.get(niche)?.label} yet`}
          body="Creators are worked out when a niche is scanned. They'll appear here after its next scan." />
      ) : (
        <div className="space-y-4">
          {PLATFORMS.map((p) => {
            const of = (r: RegionCode) => creators.filter((c) => c.platform === p.id && c.region === r);
            if (!regions.some((r) => of(r).length)) return null;
            return (
              <Card key={p.id} className="p-5">
                <h2 className="mb-3 flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SOURCE_META[p.id].color }} />{p.label}
                </h2>
                <div className={cn("grid gap-x-8 gap-y-4", regions.length === 2 && "md:grid-cols-2")}>
                  {regions.map((r) => <Column key={r} title={r === "IN" ? "India" : "Global"} region={r} list={of(r)} platform={p} />)}
                </div>
              </Card>
            );
          })}
          <p className="text-xs leading-relaxed text-faint">
            Score (0–100): reach (views, or upvotes and comments), breakout (views against subscribers, so a small channel pulling millions ranks high), relevance to what the niche is discussing now, and consistency across posts. Channels re-uploading TikToks are marked down. India means evidence the creator is Indian: the channel&apos;s country, the language YouTube says it&apos;s in, or an Indian-language title. Instagram and X don&apos;t share creator data for free, so they aren&apos;t here.
          </p>
        </div>
      )}
    </div>
  );
}

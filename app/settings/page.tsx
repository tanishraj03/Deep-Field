import { Check, KeyRound, Minus, X } from "lucide-react";
import { ScanAllButton } from "@/components/scan-runner";
import { ScheduleCard } from "@/components/schedule-card";
import { Badge, Card, Eyebrow } from "@/components/ui";
import { backgroundModel, MODELS, PROVIDERS, hasKey } from "@/lib/ai/models";
import { config } from "@/lib/config";
import { NICHES } from "@/lib/niches";
import { loadSummaries } from "@/lib/pulse/scan";
import { hasInstagram } from "@/lib/sources/instagram";
import { hasRedditApi } from "@/lib/sources/reddit";
import { getSchedule, nextRun } from "@/lib/schedule";
import { store } from "@/lib/store";
import type { SourceRun } from "@/lib/types";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const DATA = [
  { name: "Reddit", what: "Every niche's communities, India and global: threads, comments and upvotes — up to 300 posts per community per scan. Read through the Arctic Shift archive, or Reddit's own API when keys are set.", key: hasRedditApi() ? "REDDIT_CLIENT_ID ✓" : "optional · REDDIT_CLIENT_ID/SECRET for live counts", match: /^Reddit (API|\(archive\))/ },
  { name: "YouTube", what: "Trending videos per category in India and the US (25 each), most-viewed uploads for a searched topic, and top comments.", key: config.youtube.apiKey ? "YOUTUBE_API_KEY ✓" : "YOUTUBE_API_KEY (free) — not set", match: /^YouTube/ },
  { name: "X (Twitter)", what: "What is trending on X in India and worldwide, read from getdaytrends.com's public tracker. X has no free API, and scraping X itself breaks its terms.", key: "none", match: /^X trending/ },
  { name: "Instagram", what: "Top posts for a hashtag with likes and comments, through Meta's official API and your own Business or Creator account. Used by Explore; Meta allows 30 hashtags a week.", key: hasInstagram() ? "INSTAGRAM_ACCESS_TOKEN ✓" : "optional · INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_USER_ID", match: null, off: !hasInstagram() },
  { name: "Bluesky · Mastodon", what: "Trending topics, hashtags and shared links on the open social web, plus Bluesky post search with likes and replies for any topic.", key: "none", match: /^(Bluesky|Mastodon)/ },
  { name: "News", what: "Google News top stories in India and the US, sized by how many outlets cover them; GDELT and Google News article counts for a searched topic.", key: "none", match: /^Google News/ },
  { name: "Hacker News", what: "Tech front page and topic search with points and comments.", key: "none", match: /^Hacker News/ },
  { name: "Lemmy", what: "The open, federated Reddit alternative: top posts for a searched topic with real votes and comments.", key: "none", match: null },
  { name: "Wikipedia", what: "Most-read pages in India and worldwide yesterday; a topic's daily views.", key: "none", match: /^Wikipedia/ },
  { name: "Google Trends", what: "Trending searches in India and the US with Google's traffic bands.", key: "none", match: /^Google Trends/ },
];

function health(runs: SourceRun[]) {
  if (!runs.length) return { icon: Minus, tone: "text-faint", label: "not used yet" };
  const ok = runs.filter((r) => r.ok).length;
  if (ok === runs.length) return { icon: Check, tone: "text-rise", label: `working · ${runs.reduce((a, r) => a + r.count, 0)} items last scans` };
  if (ok === 0) return { icon: X, tone: "text-fall", label: runs.find((r) => r.note)?.note ?? "failing" };
  return { icon: Check, tone: "text-ember", label: `${ok}/${runs.length} OK · ${runs.find((r) => !r.ok)?.note ?? ""}` };
}

export default async function SettingsPage() {
  const [pulse, storage, schedule] = await Promise.all([loadSummaries(), store.status(), getSchedule()]);
  const runs = [...pulse.scans.flatMap((s) => s.sources), ...(pulse.signals?.sources ?? [])];
  const bg = backgroundModel();
  const byNiche = new Map(pulse.scans.map((s) => [s.niche, s]));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted">Data sources, AI models and keys, and when each niche was last read.</p>
        </div>
        <ScanAllButton />
      </div>

      <section>
        <Eyebrow className="mb-3">Schedule</Eyebrow>
        <ScheduleCard initial={schedule} initialNext={nextRun(schedule)} />
      </section>

      <section>
        <Eyebrow className="mb-3">Data</Eyebrow>
        <Card className="divide-y">
          {DATA.map((d) => {
            const h = "off" in d && d.off
              ? { icon: Minus, tone: "text-faint", label: "not connected" }
              : d.match
              ? health(runs.filter((r) => d.match.test(r.source)))
              : { icon: Check, tone: "text-muted", label: "used live by Explore searches" };
            return (
              <div key={d.name} className="grid gap-2 p-4 sm:grid-cols-[10rem_1fr_16rem] sm:items-start">
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-muted">{d.what}<span className="mt-1 block text-xs text-faint">Key: {d.key}</span></p>
                <p className={`flex items-start gap-1.5 text-xs ${h.tone}`}><h.icon className="mt-px h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2">{h.label}</span></p>
              </div>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-faint">
          Reddit counts from the archive settle ~36 hours after posting; newer threads count as volume and are labelled. Nothing is estimated — a number we do not have is left blank.
        </p>
      </section>

      <section>
        <Eyebrow className="mb-3">AI models</Eyebrow>
        <Card className="divide-y">
          {Object.values(PROVIDERS).map((p) => {
            const set = hasKey(p.id);
            const slots = MODELS.filter((m) => m.provider === p.id);
            return (
              <div key={p.id} className="grid gap-2 p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
                <p className="font-medium">{p.name}</p>
                <div className="text-sm text-muted">
                  <span className="flex flex-wrap gap-1.5">{slots.map((s) => <Badge key={s.id} tone="outline">{s.label} · {s.tags[0]}</Badge>)}</span>
                  <span className="mt-1.5 block text-xs text-faint">{p.pricing} · <code>{p.keyEnv}</code></span>
                </div>
                {set
                  ? <Badge tone="rise"><Check className="h-3 w-3" />Key set</Badge>
                  : <a href={p.keyUrl} target="_blank" rel="noreferrer"><Badge tone="outline"><KeyRound className="h-3 w-3" />Get a key</Badge></a>}
              </div>
            );
          })}
        </Card>
        <p className="mt-2 text-xs text-faint">
          Background work (grouping scans into conversations, Explore insights) uses {bg ? <strong className="text-muted">{bg.label}</strong> : "no model — add GEMINI_API_KEY"}. It only ever picks a free model; set AI_BACKGROUND_MODEL to choose.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <Eyebrow>Niches · {NICHES.length}</Eyebrow>
          <span className="text-xs text-faint">Storage: {storage.backend === "supabase" ? "Supabase" : "local file"}{storage.durable ? "" : " (not durable)"}</span>
        </div>
        <Card className="grid gap-px overflow-hidden bg-hair/[0.06] sm:grid-cols-2 lg:grid-cols-4">
          {NICHES.map((n) => {
            const s = byNiche.get(n.id);
            return (
              <div key={n.id} className="bg-surface p-3.5">
                <p className="text-sm font-medium">{n.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {s ? <>{s.topics.length} conversations · {relativeTime(s.scannedAt)}</> : "not scanned"}
                </p>
                <p className="mt-1 truncate text-[0.6875rem] text-faint" title={[...n.subreddits.IN, ...n.subreddits.GLOBAL].join(", ")}>
                  {n.subreddits.IN.length} India + {n.subreddits.GLOBAL.length} global communities
                </p>
              </div>
            );
          })}
        </Card>
        {storage.note && storage.backend !== "supabase" && <p className="mt-2 text-xs text-ember">{storage.note}</p>}
      </section>
    </div>
  );
}

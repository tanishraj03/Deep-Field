import { redirect } from "next/navigation";
import { KeyRound, Radar, Sparkles } from "lucide-react";
import { Ambient } from "@/components/ambient";
import { LoginPreview, TopicTicker, type PreviewTopic } from "@/components/login-preview";
import { currentUser } from "@/lib/auth";
import { googleConfigured, safeNext } from "@/lib/auth/google";
import { NICHES, nicheLabel } from "@/lib/niches";
import { loadSummaries } from "@/lib/pulse/scan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

const POINTS = [
  { icon: Radar, title: "Every niche, live", text: "What the internet is talking about in 20 niches, India and global, with real counts" },
  { icon: Sparkles, title: "A research assistant", text: "Grounded in live threads and numbers, not memory" },
  { icon: KeyRound, title: "Your keys, your credits", text: "Bring free keys; nobody spends anyone else's" },
];

/** Today's hottest real conversations, for the preview. Public data only, no posts. */
async function previewTopics(): Promise<{ topics: PreviewTopic[]; total: number }> {
  const pulse = await loadSummaries().catch(() => null);
  if (!pulse) return { topics: [], total: 0 };
  const all = pulse.scans.flatMap((s) => s.topics);
  const topics = [...all]
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 12)
    .map((t) => ({
      id: `${t.niche}:${t.id}`,
      title: t.title,
      niche: nicheLabel(t.niche),
      heat: t.heat,
      virality: t.virality,
      comments: t.metrics.comments,
      communities: t.metrics.communities,
      call: t.verdict?.call ?? null,
      india: t.metrics.posts ? Math.round((t.metrics.postsIN / t.metrics.posts) * 100) : 0,
    }));
  return { topics, total: all.length };
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const [{ error, next }, user, preview] = await Promise.all([searchParams, currentUser(), previewTopics()]);
  if (user) redirect(user.username ? safeNext(next ?? null) : "/welcome");
  const ready = googleConfigured();
  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <Ambient variant="hero" />

      <div className="mx-auto grid w-full max-w-[78rem] flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-6">
        <div className="relative z-10 max-w-[32rem]">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-ink shadow-[0_0_40px_-6px_rgb(var(--accent)/0.7)]">
              <span className="absolute h-4 w-4 rounded-full border-[1.5px] border-canvas" />
              <span className="absolute h-1.5 w-1.5 translate-x-[7px] -translate-y-[7px] rounded-full bg-ember" />
            </span>
            <span className="text-[1.1rem] font-semibold tracking-tight">DeepField</span>
          </div>

          {preview.total > 0 && (
            <p className="card mt-10 inline-flex items-center gap-2 rounded-pill px-3 py-1 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rise opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rise" />
              </span>
              Live: <span className="num font-medium text-ink">{preview.total}</span> conversations across {NICHES.length} niches
            </p>
          )}

          <h1 className={`${preview.total ? "mt-5" : "mt-10"} text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem]`}>
            Know what to make <span className="text-gradient">before everyone else does.</span>
          </h1>
          <p className="mt-4 text-[1.05rem] leading-relaxed text-muted">
            DeepField reads Reddit, YouTube, X trends, news and the open web, finds the conversations taking off in your niche, and tells you which are worth making.
          </p>

          <div className="mt-8 max-w-[24rem]">
            {ready ? (
              <a href={href}
                className="press group relative flex h-12 w-full items-center justify-center gap-3 rounded-pill bg-ink text-[0.9375rem] font-medium text-canvas shadow-[0_10px_40px_-10px_rgb(var(--accent)/0.8)] transition hover:shadow-[0_14px_50px_-8px_rgb(var(--accent)/0.95)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white"><GoogleMark /></span>
                Continue with Google
              </a>
            ) : (
              <div className="card p-4 text-sm">
                <p className="font-medium">Google sign-in isn&apos;t set up on this server yet.</p>
                <p className="mt-1.5 text-muted">
                  Add <code className="rounded bg-hair/10 px-1">GOOGLE_CLIENT_ID</code>, <code className="rounded bg-hair/10 px-1">GOOGLE_CLIENT_SECRET</code> and{" "}
                  <code className="rounded bg-hair/10 px-1">AUTH_SECRET</code> to the environment, then restart. The README has the steps.
                </p>
              </div>
            )}
            {error && error !== "setup" && (
              <p className="mt-3 rounded-xl bg-fall/[0.1] px-3 py-2 text-xs text-fall" role="alert">{error}</p>
            )}
            <p className="mt-3 text-center text-[0.6875rem] text-faint">
              New here? Signing in creates your account. We only read your name, email and picture.
            </p>
          </div>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {POINTS.map((p) => (
              <li key={p.title} className="card p-3.5">
                <p.icon className="h-4 w-4 text-accent" />
                <p className="mt-2 text-[0.8125rem] font-semibold">{p.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden h-[36rem] lg:block">
          <LoginPreview topics={preview.topics} />
        </div>
      </div>

      <div className="pb-6">
        <TopicTicker topics={preview.topics} />
      </div>
    </div>
  );
}

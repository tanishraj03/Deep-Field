import { redirect } from "next/navigation";
import { Ambient } from "@/components/ambient";
import { LoginPreview, type PreviewTopic } from "@/components/login-preview";
import { currentUser } from "@/lib/auth";
import { googleConfigured, safeNext } from "@/lib/auth/google";
import { NICHES, nicheLabel } from "@/lib/niches";
import { loadSummaries } from "@/lib/pulse/scan";
import { compact } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/** Today's hottest real conversations, for the preview. Public data only, no posts. */
async function previewTopics(): Promise<{ topics: PreviewTopic[]; total: number; views: number; comments: number }> {
  const pulse = await loadSummaries().catch(() => null);
  if (!pulse) return { topics: [], total: 0, views: 0, comments: 0 };
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
  // The reach behind today's conversations: big, real, and counted the same
  // way the board counts it.
  const views = all.reduce((sum, t) => sum + t.metrics.views, 0);
  const comments = all.reduce((sum, t) => sum + t.metrics.comments, 0);
  return { topics, total: all.length, views, comments };
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
  const [{ error: rawError, next }, user, preview] = await Promise.all([searchParams, currentUser(), previewTopics()]);
  // Shown as plain text, but it arrives in the address, so it is kept short.
  const error = typeof rawError === "string" ? rawError.slice(0, 160) : undefined;
  if (user) redirect(user.username ? safeNext(next ?? null) : "/welcome");
  const ready = googleConfigured();
  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;

  // "552M views and 491K comments", leaving out whichever is empty.
  const reach = [
    preview.views > 0 && { value: compact(preview.views), label: "views" },
    preview.comments > 0 && { value: compact(preview.comments), label: "comments" },
  ].filter((x): x is { value: string; label: string } => !!x);

  return (
    <div className="relative flex min-h-dvh items-center overflow-hidden">
      <Ambient variant="hero" />

      <div className="mx-auto grid w-full max-w-[76rem] items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:gap-10">
        <div className="relative z-10 mx-auto w-full max-w-[34rem] lg:mx-0">
          <div className="flex items-center gap-3.5">
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink shadow-[0_0_48px_-6px_rgb(var(--accent)/0.7)]">
              <span className="absolute h-5 w-5 rounded-full border-2 border-canvas" />
              <span className="absolute h-2 w-2 translate-x-[9px] -translate-y-[9px] rounded-full bg-ember" />
            </span>
            <span className="text-[1.75rem] font-semibold tracking-tight">DeepField</span>
          </div>

          {reach.length > 0 && (
            <p className="card mt-12 inline-flex items-center gap-2 rounded-pill px-3.5 py-1.5 text-xs text-muted">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rise opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rise" />
              </span>
              <span>
                Live:{" "}
                {reach.map((r, i) => (
                  <span key={r.label}>
                    {i > 0 && " and "}
                    <span className="num font-semibold text-ink">{r.value}</span> {r.label}
                  </span>
                ))}{" "}
                tracked across {NICHES.length} niches
              </span>
            </p>
          )}

          <h1 className={`${reach.length ? "mt-5" : "mt-12"} text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem]`}>
            Know what to make <span className="text-gradient">before everyone else does.</span>
          </h1>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-muted">
            DeepField helps you decide what to post next. It keeps an eye on Reddit, YouTube, X and the news,
            spots the topics people in your niche are starting to talk about, and tells you which ones are worth
            turning into content.
          </p>

          <div className="mt-9 max-w-[24rem]">
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
        </div>

        <div className="relative hidden h-[34rem] lg:block">
          <LoginPreview topics={preview.topics} />
        </div>
      </div>
    </div>
  );
}

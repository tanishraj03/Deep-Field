import { redirect } from "next/navigation";
import { KeyRound, Radar, Sparkles } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { googleConfigured, safeNext } from "@/lib/auth/google";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

const POINTS = [
  { icon: Radar, text: "What every niche is talking about, in India and globally, with real counts" },
  { icon: Sparkles, text: "An AI research assistant grounded in live threads, not memory" },
  { icon: KeyRound, text: "Bring your own free keys: your usage runs on your keys, nobody else's" },
];

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
  const [{ error, next }, user] = await Promise.all([searchParams, currentUser()]);
  if (user) redirect(user.username ? safeNext(next ?? null) : "/welcome");
  const ready = googleConfigured();
  const href = `/api/auth/login${next ? `?next=${encodeURIComponent(safeNext(next))}` : ""}`;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-ink">
            <span className="absolute h-3.5 w-3.5 rounded-full border-[1.5px] border-canvas" />
            <span className="absolute h-1 w-1 translate-x-[6px] -translate-y-[6px] rounded-full bg-ember" />
          </span>
          <span className="text-[1.05rem] font-semibold tracking-tight">DeepField</span>
        </div>

        <h1 className="mt-8 text-[1.75rem] font-semibold leading-tight tracking-tight">What should you make content about?</h1>
        <p className="mt-2 text-[0.95rem] text-muted">Sign in to see what the internet is talking about in your niche, and dig into any topic.</p>

        <ul className="mt-6 space-y-3">
          {POINTS.map((p) => (
            <li key={p.text} className="flex items-start gap-3 text-sm text-muted">
              <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-hair/[0.06]"><p.icon className="h-3.5 w-3.5" /></span>
              {p.text}
            </li>
          ))}
        </ul>

        <div className="card mt-8 p-5">
          {ready ? (
            <a href={href}
              className="press flex h-11 w-full items-center justify-center gap-2.5 rounded-pill bg-surface text-[0.875rem] font-medium ring-1 ring-hair/15 transition hover:ring-hair/30">
              <GoogleMark />Continue with Google
            </a>
          ) : (
            <div className="text-sm">
              <p className="font-medium">Google sign-in isn&apos;t set up on this server yet.</p>
              <p className="mt-1.5 text-muted">
                Add <code className="rounded bg-hair/10 px-1">GOOGLE_CLIENT_ID</code>, <code className="rounded bg-hair/10 px-1">GOOGLE_CLIENT_SECRET</code> and{" "}
                <code className="rounded bg-hair/10 px-1">AUTH_SECRET</code> to the environment, then restart. The README has the steps.
              </p>
            </div>
          )}
          {error && error !== "setup" && (
            <p className="mt-3 rounded-xl bg-fall/[0.08] px-3 py-2 text-xs text-fall" role="alert">{error}</p>
          )}
          <p className="mt-4 text-center text-[0.6875rem] leading-relaxed text-faint">
            We only read your name, email and profile picture from Google. New here? Signing in creates your account.
          </p>
        </div>
      </div>
    </div>
  );
}

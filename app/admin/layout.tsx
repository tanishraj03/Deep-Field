import Link from "next/link";
import { LogOut, Rss, ShieldCheck } from "lucide-react";
import { Ambient } from "@/components/ambient";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service dashboard", robots: { index: false, follow: false } };

/** The service dashboard's frame: its own header, with the way back to the feed. Admin only; anyone else gets a 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="relative min-h-dvh">
      <Ambient />
      <header className="sticky top-0 z-30 border-b bg-canvas/85">
        <div className="mx-auto flex max-w-[78rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-ink">
              <span className="absolute h-3.5 w-3.5 rounded-full border-[1.5px] border-canvas" />
              <span className="absolute h-1 w-1 translate-x-[6px] -translate-y-[6px] rounded-full bg-ember" />
            </span>
            <span className="font-semibold tracking-tight">DeepField</span>
            <span className="hidden items-center gap-1 rounded-pill bg-accent/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-accent sm:inline-flex">
              <ShieldCheck className="h-3 w-3" />Service dashboard
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link href="/" className="press inline-flex h-9 items-center gap-1.5 rounded-pill bg-ink px-4 text-[0.8125rem] font-medium text-canvas hover:opacity-90">
              <Rss className="h-4 w-4" />My DeepField feed
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" aria-label="Sign out" title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:bg-hair/[0.05] hover:text-ink">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[78rem] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">{children}</main>
    </div>
  );
}

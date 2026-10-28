import Link from "next/link";
import { ArrowRight, Rss, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/** Where the admin lands after signing in: the service dashboard, or their own feed. */
export default async function AdminStart() {
  const admin = await requireAdmin();
  const choices = [
    { href: "/admin", icon: ShieldCheck, title: "Service dashboard", body: "Who's using DeepField, sign-ins, and the platform's switches." },
    { href: "/", icon: Rss, title: "My DeepField feed", body: "Your niches, Explore and the assistant, the same as everyone sees." },
  ];
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-[44rem] flex-col justify-center">
      <h1 className="text-[1.75rem] font-semibold tracking-tight">Welcome back, {admin.name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted">Where to? You can switch any time from the sidebar or the top of the dashboard.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {choices.map((c) => (
          <Link key={c.href} href={c.href} className="card card-hover group p-5">
            <c.icon className="h-5 w-5 text-accent" />
            <p className="mt-4 flex items-center gap-1.5 font-semibold">{c.title}<ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" /></p>
            <p className="mt-1 text-sm text-muted">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

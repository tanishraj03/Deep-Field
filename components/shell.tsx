"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, Laptop, Moon, Search, Settings, Sparkles, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme";

const NAV = [
  { href: "/", label: "Pulse", icon: Activity, hint: "What's being talked about" },
  { href: "/explore", label: "Explore", icon: Search, hint: "Research any topic" },
  { href: "/assistant", label: "Assistant", icon: Sparkles, hint: "Ask and dig deeper" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/topic");
  return path.startsWith(href);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
        <span className="absolute h-3 w-3 rounded-full border-[1.5px] border-canvas" />
        <span className="absolute h-1 w-1 translate-x-[5px] -translate-y-[5px] rounded-full bg-ember" />
      </span>
      <span className="text-[0.95rem] font-semibold tracking-tight">DeepField</span>
    </Link>
  );
}

/** Data sources, models and keys live behind this, out of the main navigation. */
function SettingsLink() {
  const active = usePathname().startsWith("/settings");
  return (
    <Link href="/settings" aria-label="Settings" title="Settings: sources, models and keys"
      className={cn("rounded-pill p-2 transition-colors", active ? "bg-hair/[0.07] text-ink" : "text-faint hover:bg-hair/[0.05] hover:text-ink")}>
      <Settings className="h-4 w-4" />
    </Link>
  );
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const opts = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Laptop, label: "System" },
  ] as const;
  return (
    <div className="flex items-center gap-0.5 rounded-pill bg-hair/[0.05] p-0.5" role="group" aria-label="Appearance">
      {opts.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          aria-label={label}
          aria-pressed={theme === id}
          className={cn("relative rounded-pill p-1.5 transition-colors", theme === id ? "text-ink" : "text-faint hover:text-muted")}
        >
          {theme === id && (
            <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-pill bg-surface shadow-sm ring-1 ring-hair/10"
              transition={{ type: "spring", stiffness: 500, damping: 38 }} />
          )}
          <Icon className="relative h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // The assistant is a full-height workspace; everything else scrolls.
  const fullBleed = path.startsWith("/assistant");

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r px-3 py-5 lg:flex">
        <Logo />
        <nav className="mt-8 space-y-0.5" aria-label="Main">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.875rem] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink hover:bg-hair/[0.04]",
                )}
              >
                {active && (
                  <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-hair/[0.07]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <n.icon className="relative h-4 w-4" strokeWidth={2} />
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between px-1">
          <ThemeSwitch />
          <SettingsLink />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-canvas/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-1"><ThemeSwitch /><SettingsLink /></div>
      </header>

      <main className={cn("min-w-0 flex-1", fullBleed ? "" : "px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8")}>
        {fullBleed ? children : <div className="mx-auto max-w-[78rem]">{children}</div>}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-canvas/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="flex">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                className={cn("flex flex-1 flex-col items-center gap-1 py-2.5", active ? "text-ink" : "text-faint")}>
                <n.icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[0.625rem] font-medium">{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

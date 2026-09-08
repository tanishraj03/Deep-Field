"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Banknote, Bookmark, Megaphone, Radio, Settings, Sun, Moon, Laptop, Target, Sunrise,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme";

const NAV = [
  { href: "/", desktop: "Today", mobile: "Today", icon: Sunrise },
  { href: "/signals", desktop: "What's Moving", mobile: "Signals", icon: Radio },
  { href: "/money", desktop: "Money Moves", mobile: "Money", icon: Banknote },
  { href: "/spend", desktop: "Who's Spending", mobile: "Spend", icon: Megaphone },
  { href: "/opportunities", desktop: "Who We Should Talk To", mobile: null, icon: Target },
  { href: "/saved", desktop: "Saved", mobile: "Saved", icon: Bookmark },
];

function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const opts = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Laptop, label: "System" },
  ] as const;

  return (
    <div className="glass flex items-center gap-0.5 rounded-pill p-0.5" role="group" aria-label="Appearance">
      {opts.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          aria-label={label}
          aria-pressed={theme === id}
          className={cn(
            "press relative rounded-pill p-1.5 transition-colors",
            theme === id ? "text-ink" : "text-faint hover:text-muted",
          )}
        >
          {theme === id && (
            <motion.span
              layoutId="theme-pill"
              className="absolute inset-0 rounded-pill"
              style={{ background: "rgb(var(--hair) / 0.08)" }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <Icon className="relative h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

export function Chrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="min-h-dvh">
      {/* Desktop rail */}
      <header className="sticky top-0 z-40 hidden lg:block">
        <div className="mx-auto flex max-w-[76rem] items-center gap-3 px-8 pt-5">
          <nav className="glass glass-lit flex flex-1 items-center gap-0.5 rounded-pill p-1" aria-label="Main">
            {NAV.map((n) => {
              const active = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "press relative rounded-pill px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-pill"
                      style={{ background: "rgb(var(--hair) / 0.075)" }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className="relative">{n.desktop}</span>
                </Link>
              );
            })}
            <div className="ml-auto flex items-center gap-1 pr-1">
              <Link
                href="/settings"
                aria-label="Settings"
                className={cn("press rounded-pill p-2 transition-colors",
                  path.startsWith("/settings") ? "text-ink" : "text-faint hover:text-ink")}
              >
                <Settings className="h-4 w-4" strokeWidth={1.9} />
              </Link>
            </div>
          </nav>
          <ThemeSwitch />
        </div>
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 lg:hidden">
        <div className="flex items-center justify-end px-5 pt-4">
          <ThemeSwitch />
        </div>
      </header>

      <main className="mx-auto max-w-[76rem] px-5 pb-32 pt-4 lg:px-8 lg:pb-24 lg:pt-8">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="glass glass-lit mx-3 mb-3 flex items-stretch justify-between rounded-module px-1 py-1.5">
          {NAV.filter((n) => n.mobile).map((n) => {
            const active = path === n.href;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex min-w-[3.75rem] flex-1 flex-col items-center gap-1 rounded-tile py-1.5 transition-colors",
                  active ? "text-ink" : "text-faint",
                )}
              >
                <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[0.625rem] font-medium tracking-tight">{n.mobile}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

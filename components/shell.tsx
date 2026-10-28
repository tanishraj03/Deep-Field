"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, CircleHelp, KeyRound, Laptop, LogOut, Moon, PanelLeftClose, PanelLeftOpen, Search, Settings, SlidersHorizontal, Sparkles, Sun } from "lucide-react";
import { cn, SIDEBAR_COOKIE } from "@/lib/utils";
import { Ambient } from "./ambient";
import { useTheme } from "./theme";

const NAV = [
  { href: "/", label: "Pulse", icon: Activity, hint: "What's being talked about" },
  { href: "/explore", label: "Explore", icon: Search, hint: "Research any topic" },
  { href: "/assistant", label: "Assistant", icon: Sparkles, hint: "Ask and dig deeper" },
];

/** Below the main screens on desktop; in the account menu on phones. */
const MORE = [
  { href: "/keys", label: "Keys", icon: KeyRound },
  { href: "/help", label: "Help & FAQ", icon: CircleHelp },
];

export interface Account { username: string; name: string; email: string; picture: string | null; owner: boolean }

/** Screens shown without navigation: signing in and onboarding. */
const BARE = ["/login", "/welcome"];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/topic");
  return path.startsWith(href);
}

function Logo({ iconOnly }: { iconOnly?: boolean }) {
  return (
    <Link href="/" aria-label="DeepField" className={cn("flex items-center gap-2.5", iconOnly ? "justify-center" : "px-2")}>
      <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
        <span className="absolute h-3 w-3 rounded-full border-[1.5px] border-canvas" />
        <span className="absolute h-1 w-1 translate-x-[5px] -translate-y-[5px] rounded-full bg-ember" />
      </span>
      {!iconOnly && <span className="text-[0.95rem] font-semibold tracking-tight">DeepField</span>}
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

function ThemeSwitch({ vertical }: { vertical?: boolean }) {
  const { theme, setTheme } = useTheme();
  const opts = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "dark", icon: Moon, label: "Dark" },
    { id: "system", icon: Laptop, label: "System" },
  ] as const;
  return (
    <div className={cn("flex items-center gap-0.5 rounded-pill bg-hair/[0.05] p-0.5", vertical && "flex-col")} role="group" aria-label="Appearance">
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

function Avatar({ account, size = 28 }: { account: Account; size?: number }) {
  return account.picture
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={account.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full" />
    : (
      <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold uppercase text-accent">
        {account.username[0]}
      </span>
    );
}

/** Who is signed in, with preferences, keys, help and sign out. */
function AccountMenu({ account, compact, rail }: { account: Account; compact?: boolean; rail?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const items = [
    { href: "/welcome?edit=1", label: "Feed preferences", icon: SlidersHorizontal },
    ...MORE,
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        title={rail ? `@${account.username}` : undefined}
        className={cn("flex items-center gap-2 rounded-pill transition-colors hover:bg-hair/[0.05]", compact || rail ? "p-1" : "w-full p-1.5 pr-3")}>
        <Avatar account={account} size={compact ? 26 : 28} />
        {!compact && !rail && (
          <span className="min-w-0 text-left">
            <span className="block truncate text-[0.8125rem] font-medium">@{account.username}</span>
            <span className="block truncate text-[0.6875rem] text-faint">{account.email}</span>
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu"
            initial={{ opacity: 0, y: compact ? -4 : 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className={cn("card absolute z-50 w-60 p-1.5 shadow-2xl", compact ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2")}>
            <div className="px-2.5 pb-2 pt-1.5">
              <p className="truncate text-[0.8125rem] font-semibold">{account.name}</p>
              <p className="truncate text-[0.6875rem] text-faint">{account.email}{account.owner ? " · owner" : ""}</p>
            </div>
            {items.map((i) => (
              <Link key={i.href} href={i.href} role="menuitem"
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-muted hover:bg-hair/[0.05] hover:text-ink">
                <i.icon className="h-4 w-4" />{i.label}
              </Link>
            ))}
            <form action="/api/auth/logout" method="post" className="mt-1 border-t pt-1">
              <button type="submit" role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] text-muted hover:bg-hair/[0.05] hover:text-ink">
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RailLink({ href, label, icon: Icon, active, collapsed, small, layoutId }: {
  href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean; small?: boolean; layoutId?: string;
}) {
  return (
    <Link href={href} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl font-medium transition-colors",
        small ? "py-1.5 text-[0.8125rem]" : "py-2 text-[0.875rem]",
        collapsed ? "justify-center px-0" : "px-3",
        active ? "text-ink" : "text-muted hover:bg-hair/[0.04] hover:text-ink",
        active && !layoutId && "bg-hair/[0.07]",
      )}>
      {active && layoutId && (
        <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-hair/[0.07]"
          transition={{ type: "spring", stiffness: 500, damping: 40 }} />
      )}
      <Icon className="relative h-4 w-4 shrink-0" strokeWidth={2} />
      {!collapsed && <span className="relative truncate">{label}</span>}
    </Link>
  );
}

export function Shell({ children, account, initialCollapsed = false }: { children: React.ReactNode; account: Account | null; initialCollapsed?: boolean }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);
  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "closed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);
  // Ctrl/Cmd + \ toggles the sidebar.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [toggle]);
  // The assistant is a full-height workspace; everything else scrolls.
  const fullBleed = path.startsWith("/assistant");

  if (!account || BARE.some((p) => path.startsWith(p))) {
    return <main className="min-h-dvh">{children}</main>;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleButton = (
    <button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl/⌘ \\)`}
      aria-expanded={!collapsed}
      className="rounded-lg p-1.5 text-faint transition-colors hover:bg-hair/[0.05] hover:text-ink">
      <ToggleIcon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <Ambient />
      <aside className={cn(
        "sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r bg-canvas/55 py-5 backdrop-blur-xl transition-[width] duration-300 ease-ios lg:flex",
        collapsed ? "w-[4.25rem] px-2.5" : "w-60 px-3",
      )}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between")}>
          <Logo iconOnly={collapsed} />
          {toggleButton}
        </div>
        <nav className="mt-8 space-y-0.5" aria-label="Main">
          {NAV.map((n) => <RailLink key={n.href} {...n} active={isActive(path, n.href)} collapsed={collapsed} layoutId="nav-active" />)}
        </nav>
        <nav className="mt-6 space-y-0.5 border-t pt-4" aria-label="More">
          {MORE.map((n) => <RailLink key={n.href} {...n} active={path.startsWith(n.href)} collapsed={collapsed} small />)}
        </nav>
        <div className="mt-auto space-y-3">
          <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "justify-between px-1")}>
            <ThemeSwitch vertical={collapsed} />
            <SettingsLink />
          </div>
          <div className={cn(collapsed && "flex justify-center")}>
            <AccountMenu account={account} rail={collapsed} />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-canvas/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-1"><ThemeSwitch /><AccountMenu account={account} compact /></div>
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

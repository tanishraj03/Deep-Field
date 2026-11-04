"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system", setTheme: () => {},
});

const readSaved = (): Theme => {
  try {
    const t = localStorage.getItem("df-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch { return "system"; }
};

/**
 * Set the theme class without a flicker: transitions are switched off for
 * the one frame the colours change, so nothing fades between themes at its
 * own speed. Does nothing when the class is already right.
 */
function apply(t: Theme) {
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  if (root.classList.contains("dark") === dark) return;
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  root.classList.toggle("dark", dark);
  // Force a style flush before transitions come back.
  void window.getComputedStyle(root).color;
  requestAnimationFrame(() => style.remove());
}

/**
 * The inline script in app/layout.tsx sets the theme before the first paint.
 * This only takes over after reading the saved choice: it used to apply its
 * "system" default first, which flipped a page set to Light or Dark to the
 * other theme for a frame on every full page load.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => { setThemeState(readSaved()); }, []);

  useEffect(() => {
    if (!theme) return;
    apply(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Another tab changed the theme: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === "df-theme") setThemeState(readSaved()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("df-theme", t); } catch {}
  }, []);

  return <Ctx.Provider value={{ theme: theme ?? "system", setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

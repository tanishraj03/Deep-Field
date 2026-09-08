import type { Category, IntelligenceItem, Platform, Region } from "@/lib/types";

// Pure and dependency-free, like lib/filters.ts — the browser imports this and
// must never end up reaching the server-only storage layer through it.

export const PREFS_KEY = "df-prefs";

export interface Prefs {
  /** At least one. An empty array is treated as "everything". */
  regions: Region[];
  /** Empty means every platform. */
  platforms: Platform[];
  /** Empty means every industry. */
  industries: Category[];
  /** What the person told us during setup. The real wiring is server-side. */
  slackIntent: boolean;
  completedAt: string | null;
}

export const defaultPrefs: Prefs = {
  regions: ["IN", "GLOBAL"],
  platforms: [],
  industries: [],
  slackIntent: false,
  completedAt: null,
};

export const REGION_OPTIONS: { id: Region; label: string; hint: string }[] = [
  { id: "IN", label: "India", hint: "Entrackr, Inc42, YourStory, Social Samosa, Google Trends IN" },
  { id: "US", label: "United States", hint: "TechCrunch, Adweek, Marketing Dive, Google Trends US" },
  { id: "EU", label: "Europe", hint: "EU-Startups" },
  { id: "SEA", label: "Southeast Asia", hint: "Tech in Asia" },
  { id: "ME", label: "Middle East", hint: "Wamda" },
  { id: "GLOBAL", label: "Global", hint: "Platform newsrooms, Reddit, Hacker News" },
];

export const PLATFORM_OPTIONS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "reddit", label: "Reddit" },
  { id: "x", label: "X" },
  { id: "google-trends", label: "Google Trends" },
  { id: "web", label: "Web & press" },
];

export const INDUSTRY_OPTIONS: Category[] = [
  "Consumer", "D2C", "Fintech", "AI", "Creator Economy", "Beauty", "Fashion",
  "Food", "Gaming", "Fitness", "Travel", "Media", "Edtech", "Healthtech",
  "SaaS", "Technology", "Mobility", "Climate",
];

/** Nothing selected is a legitimate answer meaning "no filter", not an error. */
export function isEmptyFeed(p: Prefs): boolean {
  return p.regions.length === 0 && p.platforms.length === 0 && p.industries.length === 0;
}

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      regions: Array.isArray(parsed.regions) ? parsed.regions : defaultPrefs.regions,
      platforms: Array.isArray(parsed.platforms) ? parsed.platforms : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
      slackIntent: Boolean(parsed.slackIntent),
      completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(p: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

/**
 * The feed the person built during setup. Applied before the on-screen filters,
 * and always announced in the interface with a way out — a filter nobody can
 * see is indistinguishable from missing data, which is the thing we refuse to do.
 */
export function applyPrefs(items: IntelligenceItem[], p: Prefs): IntelligenceItem[] {
  return items.filter((i) => {
    if (p.regions.length && !p.regions.includes(i.region)) return false;
    if (p.platforms.length && !p.platforms.includes(i.platform)) return false;
    if (p.industries.length && !i.categories.some((c) => p.industries.includes(c))) return false;
    return true;
  });
}

/** Human summary for the "your feed" line. */
export function describePrefs(p: Prefs): string {
  const parts: string[] = [];
  parts.push(
    p.regions.length === 0 || p.regions.length === REGION_OPTIONS.length
      ? "All regions"
      : p.regions.map((r) => REGION_OPTIONS.find((o) => o.id === r)?.label ?? r).join(" + "),
  );
  parts.push(p.platforms.length ? `${p.platforms.length} platforms` : "All platforms");
  parts.push(p.industries.length ? `${p.industries.length} industries` : "All industries");
  return parts.join(" · ");
}

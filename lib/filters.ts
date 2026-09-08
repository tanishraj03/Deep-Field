import type { IntelligenceItem } from "@/lib/types";

// Pure, dependency-free filtering so the client bundle never reaches into the
// server-only storage layer. Both the browser and the pipeline use this file.

export interface FilterState {
  scope: "INDIA" | "GLOBAL" | "ALL";
  platform: string;
  category: string;
  strength: string;
  windowDays: number;
  query: string;
}

export const defaultFilters: FilterState = {
  scope: "INDIA", platform: "All", category: "All", strength: "All", windowDays: 1, query: "",
};

/**
 * Universal search runs across every field a person might remember:
 * the headline, the company, the investor, the source that reported it.
 */
export function applyFilters(items: IntelligenceItem[], f: FilterState): IntelligenceItem[] {
  const cutoff = Date.now() - f.windowDays * 86_400_000;
  const q = f.query.trim().toLowerCase();

  return items.filter((i) => {
    if (f.scope === "INDIA" && i.region !== "IN") return false;
    if (f.scope === "GLOBAL" && i.region === "IN") return false;
    if (f.platform !== "All" && i.platform !== f.platform) return false;
    if (f.category !== "All" && !i.categories.includes(f.category as never)) return false;
    if (f.strength !== "All" && i.trendLabel !== f.strength) return false;

    const when = Date.parse(i.publishedAt ?? i.firstSeenAt);
    if (Number.isFinite(when) && when < cutoff) return false;

    if (q) {
      const hay = [
        i.title, i.summary, i.categories.join(" "),
        i.funding?.companyName, i.marketing?.companyName,
        i.funding?.investors.join(" "), i.sources.map((s) => s.name).join(" "),
        i.creatorCategories?.join(" "), i.contactRoles?.join(" "),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

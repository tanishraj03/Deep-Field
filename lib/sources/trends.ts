import { XMLParser } from "fast-xml-parser";
import { guessNiche } from "@/lib/niches";
import type { Signal } from "@/lib/types";
import { hash, stripHtml } from "@/lib/utils";
import { getText } from "./http";

/**
 * Google Trends' public "trending now" feed per country. The traffic figure
 * ("200K+") is Google's own bucketed estimate of searches, so it is shown
 * as Google states it.
 */

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function parseTraffic(s: string): number {
  const m = s.replace(/[,+]/g, "").match(/([\d.]+)\s*([KM]?)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return Math.round(n * (m[2].toUpperCase() === "M" ? 1e6 : m[2].toUpperCase() === "K" ? 1e3 : 1));
}

export async function trending(geo: "IN" | "US"): Promise<Signal[]> {
  const doc = parser.parse(await getText(`https://trends.google.com/trending/rss?geo=${geo}`)) as Record<string, any>;
  const items = doc?.rss?.channel?.item;
  const list: Record<string, any>[] = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, 25).map((it) => {
    const title = stripHtml(String(it.title ?? ""));
    const traffic = String(it["ht:approx_traffic"] ?? "").trim();
    const news = it["ht:news_item"];
    const first = (Array.isArray(news) ? news[0] : news) as Record<string, unknown> | undefined;
    const headline = stripHtml(String(first?.["ht:news_item_title"] ?? ""));
    return {
      id: `gt:${geo}:${hash(title)}`,
      source: "google-trends" as const,
      title,
      url: `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(title)}&date=now%207-d`,
      region: geo === "IN" ? "IN" as const : "GLOBAL" as const,
      measure: traffic ? `${traffic} searches` : "rising searches",
      value: parseTraffic(traffic),
      niche: guessNiche(`${title} ${headline}`),
      context: headline || undefined,
    };
  }).filter((s) => s.title);
}

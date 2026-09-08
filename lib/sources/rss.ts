import { XMLParser } from "fast-xml-parser";
import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, stripHtml, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"] ?? "");
  }
  return "";
}

function pickLink(entry: Record<string, unknown>): string {
  const link = entry.link;
  if (typeof link === "string") return link;
  const arr = asArray(link as Record<string, unknown> | Record<string, unknown>[]);
  for (const l of arr) {
    if (typeof l === "string") return l;
    const rel = l["@_rel"];
    const href = l["@_href"];
    if (href && (!rel || rel === "alternate")) return String(href);
  }
  if (typeof entry.guid === "string" && entry.guid.startsWith("http")) return entry.guid;
  return text(entry.guid);
}

function pickDate(entry: Record<string, unknown>): string | null {
  const raw =
    text(entry.pubDate) || text(entry.published) || text(entry.updated) ||
    text(entry["dc:date"]) || text(entry.date);
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/**
 * Generic RSS 2.0 / Atom reader. This is Tier 2 of the free-source strategy:
 * publishers put these feeds out precisely so readers like this can consume them.
 * One polite request per feed per run. No crawling, no pagination, no bypassing.
 */
export const rssAdapter: SourceAdapter = {
  kind: "rss",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const res = await fetchWithTimeout(def.url, config.ingestion.perSourceTimeoutMs, {
      headers: {
        "User-Agent": config.ingestion.userAgent,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const doc = parser.parse(xml) as Record<string, any>;
    const entries: Record<string, unknown>[] =
      asArray(doc?.rss?.channel?.item) .length ? asArray(doc.rss.channel.item)
      : asArray(doc?.feed?.entry).length ? asArray(doc.feed.entry)
      : asArray(doc?.["rdf:RDF"]?.item);

    const fetchedAt = new Date().toISOString();
    const out: RawItem[] = [];

    for (const e of entries.slice(0, 30)) {
      const title = stripHtml(text(e.title));
      const url = pickLink(e);
      if (!title || !url) continue;
      const body = stripHtml(
        text(e.description) || text(e.summary) || text(e.content) ||
        text((e as any)["content:encoded"]),
      );
      const canonical = canonicalUrl(url);
      out.push({
        key: hash(canonical),
        title,
        summary: truncate(body, 420),
        url,
        canonicalUrl: canonical,
        sourceName: def.name,
        sourceType: def.sourceType,
        publishedAt: pickDate(e),
        fetchedAt,
        region: def.region,
        platform: def.platform,
        categories: def.categories,
        language: "en",
      });
    }
    return out;
  },
};

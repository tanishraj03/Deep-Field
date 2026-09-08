import { XMLParser } from "fast-xml-parser";
import { config } from "@/lib/config";
import { canonicalUrl, fetchWithTimeout, hash, stripHtml, truncate } from "@/lib/utils";
import type { RawItem } from "@/lib/types";
import type { SourceAdapter, SourceDefinition } from "./types";

// processEntities:false — Reddit escapes whole HTML documents inside <content>,
// which trips fast-xml-parser's 1000-entity expansion guard and threw away the
// feed. We strip the markup ourselves anyway, so entities need no expanding.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: false,
});

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];
}

/**
 * Reddit's <content> is an HTML document escaped into a text node, so it
 * arrives double-encoded. Entities must be decoded BEFORE tags are stripped —
 * stripHtml decodes afterwards, which would leave "&lt;p&gt;" as visible
 * "<p>" in the summary.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp|#39));/gi, (_m, dec, hex, name) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      switch (String(name).toLowerCase()) {
        case "amp": return "&";
        case "lt": return "<";
        case "gt": return ">";
        case "quot": return '"';
        case "apos": case "#39": return "'";
        default: return " ";
      }
    });
}

/**
 * Reddit's per-subreddit Atom feed.
 *
 * This used to read the listing JSON (/new.json), which Reddit now answers
 * with HTTP 403 for unauthenticated clients — it took out all five community
 * sources every run. The .rss feeds are still published openly and are read
 * here as intended: one request per subreddit per run, spaced by
 * REDDIT_MIN_GAP_MS, and a 429 ends that source for the day rather than being
 * retried into.
 *
 * What is lost is worth stating plainly: the JSON carried upvote and comment
 * counts, which were real measured numbers. Atom carries none, so items from
 * here now have no engagement evidence attached and must not be presented as
 * though they do. They stay labelled a community SIGNAL, never a measurement.
 */
const REDDIT_MIN_GAP_MS = 2500;

export const redditAdapter: SourceAdapter = {
  kind: "reddit",
  async fetch(def: SourceDefinition): Promise<RawItem[]> {
    const res = await fetchWithTimeout(def.url, config.ingestion.perSourceTimeoutMs, {
      headers: {
        "User-Agent": config.ingestion.userAgent,
        Accept: "application/atom+xml, application/xml, text/xml;q=0.9",
      },
      cache: "no-store",
      minDelayMs: REDDIT_MIN_GAP_MS,
    });
    if (res.status === 429) throw new Error("rate limited (429) — backing off until tomorrow");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const doc = parser.parse(await res.text()) as Record<string, any>;
    const entries = asArray<Record<string, any>>(doc?.feed?.entry);
    const fetchedAt = new Date().toISOString();
    const sub = def.name.replace(/^r\//, "");
    const out: RawItem[] = [];

    for (const e of entries.slice(0, 25)) {
      const title = stripHtml(decodeEntities(String(e.title ?? "")));
      const link = e.link?.["@_href"] ?? e.link?.[0]?.["@_href"] ?? "";
      const url = String(link);
      if (!title || !url) continue;

      // Atom content is escaped HTML containing the post body plus Reddit's own
      // "[link] [comments]" furniture. Strip it back to readable text.
      const body = stripHtml(decodeEntities(String(e.content?.["#text"] ?? e.content ?? "")))
        .replace(/submitted by\s*\/u\/\S+/i, "")
        .replace(/\[(link|comments)\]/gi, "")
        .trim();

      const canonical = canonicalUrl(url);
      out.push({
        key: hash(canonical),
        title,
        summary: truncate(body || `Discussion in r/${sub}`, 420),
        url,
        canonicalUrl: canonical,
        sourceName: `r/${sub}`,
        sourceType: def.sourceType,
        publishedAt: e.published ? new Date(String(e.published)).toISOString()
          : e.updated ? new Date(String(e.updated)).toISOString() : null,
        fetchedAt,
        region: def.region,
        platform: "reddit",
        categories: def.categories,
        language: "en",
      });
    }
    return out;
  },
};

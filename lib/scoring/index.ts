import { SOURCE_TIER, type IntelligenceItem, type ScoreBreakdown } from "@/lib/types";
import type { Cluster } from "@/lib/dedup";
import { clamp01, daysAgo } from "@/lib/utils";

// Every score in this file is computed from evidence we actually hold.
// Where a component has no evidence behind it, it contributes its neutral value
// and the item is flagged `scoreIsEstimated` so the UI can say so out loud.

const CREATOR_RE = /\b(creator|influencer|reels?|shorts?|tiktok|ugc|meme|format|viral|audio|podcast|fandom|gen ?z|instagram|youtube|snapchat|pinterest|threads|twitch|substack|short-?form|vertical video|livestream|live ?shopping|creator economy|social media|subscriber|follower|engagement)\b/i;
const BRAND_RE = /\b(brand|campaign|consumer|d2c|retail|shopper|ambassador|launch|marketing)\b/i;
/**
 * Searches people run to get something done, not because culture moved.
 * These dominate Google Trends daily lists and are noise for this desk.
 */
const UTILITY_SEARCH_RE = /\b(weather|forecast|temperature|rainfall|monsoon|earthquake|aqi|air quality|result|results|admit card|answer key|merit list|cut ?off|recruitment|vacancy|exam|board exam|neet|jee|upsc|ssc|login|password|otp|ifsc|pin ?code|petrol price|gold rate|silver rate|share price|stock price|exchange rate|live score|scorecard|vs .* live|match (result|score)|horoscope|rashifal|panchang|holiday list)\b/i;

/**
 * Signals that a search spike is a CULTURE moment rather than hard news.
 *
 * Google Trends ranks everything a country googles — stock tickers, fixtures,
 * immigration policy. An influencer desk cares about the slice that is film,
 * television, music, celebrity and internet humour, because that is what
 * creators make content about. Matched against the term plus the news headline
 * Google attaches to it, and covering Devanagari because a Hindi entertainment
 * story is exactly the case this exists for.
 */
const CULTURE_RE = new RegExp(
  "\\b(show|series|episode|season|premiere|trailer|teaser|cast|casting|cancel?led|renewed" +
  "|film|movie|cinema|box office|ott|streaming|netflix|prime video|hotstar|jiocinema|zee5|sony liv" +
  "|actor|actress|star|celebrity|singer|rapper|song|music|album|track|concert|tour|jingle" +
  "|comedian|comedy|roast|meme|viral|trend(?:ing)?|fandom|stan|reality (?:show|tv)|bigg boss" +
  "|influencer|creator|youtuber|streamer|podcast|collab|wedding|engagement|birthday|controversy" +
  "|award|awards|festival|anniversary|reunion|biopic|web series|dance|challenge)\\b" +
  "|(शो|फ़िल्म|फिल्म|सीरीज|अभिनेता|अभिनेत्री|गाना|गाने|संगीत|मीम|वायरल|कलाकार|एपिसोड|सितारे|शादी)",
  "i",
);

const CONSUMER_RE = /\b(app|consumer|shopper|shopping|social commerce|checkout|d2c|retail|subscription|user growth|downloads|gifting|festive)\b/i;

function pts(label: string, weight: number, value01: number, note: string): ScoreBreakdown {
  return { label, weight, value: Math.round(clamp01(value01) * weight), note };
}

function recency01(iso: string | null, halfLifeDays: number): number {
  const d = daysAgo(iso);
  if (d >= 900) return 0;
  return Math.pow(0.5, d / halfLifeDays);
}

// ── Trend score ───────────────────────────────────────────────────────────────

export function scoreTrend(c: Cluster, prevMentions: number): {
  score: number; label: IntelligenceItem["trendLabel"]; breakdown: ScoreBreakdown[]; estimated: boolean;
} {
  const hay = `${c.primary.title} ${c.primary.summary}`;
  const independent = new Set(c.sources.map((s) => new URL(s.url).hostname.replace(/^www\./, ""))).size;
  const platforms = new Set(c.members.map((m) => m.platform)).size;
  const measured = c.members.some((m) => m.platform === "google-trends" || m.platform === "reddit");

  // Acceleration: today's independent mentions against what we logged yesterday.
  const growth = prevMentions === 0
    ? (independent > 1 ? 0.7 : 0.45)
    : clamp01((independent - prevMentions) / Math.max(2, prevMentions) + 0.4);

  const breakdown: ScoreBreakdown[] = [
    pts("Recency", 25, recency01(c.primary.publishedAt, 1.5), `Published ${Math.round(daysAgo(c.primary.publishedAt) * 24)}h ago`),
    pts("Growth rate", 20, growth, prevMentions === 0 ? "First time we have seen this" : `${prevMentions} → ${independent} independent mentions`),
    pts("Independent sources", 20, clamp01(independent / 4), `${independent} distinct domain${independent === 1 ? "" : "s"}`),
    pts("Cross-platform spread", 10, clamp01((platforms - 1) / 3), `Seen on ${platforms} platform${platforms === 1 ? "" : "s"}`),
    pts("Geographic relevance", 10, c.primary.region === "IN" ? 1 : 0.55, c.primary.region === "IN" ? "India-relevant" : "Global"),
    pts("Creator relevance", 10, CREATOR_RE.test(hay) ? 0.95 : 0.3, CREATOR_RE.test(hay) ? "Creator-shaped language present" : "Limited creator framing"),
    pts("Brand relevance", 5, BRAND_RE.test(hay) ? 0.9 : 0.35, BRAND_RE.test(hay) ? "Brand activation possible" : "No clear brand angle yet"),
  ];

  const score = breakdown.reduce((a, b) => a + b.value, 0);
  const label: IntelligenceItem["trendLabel"] =
    score >= 90 ? "BREAKOUT" : score >= 75 ? "RISING" : score >= 55 ? "WATCH" : "LOW SIGNAL";

  return { score, label, breakdown, estimated: !measured };
}

// ── Opportunity score ─────────────────────────────────────────────────────────
// Weights fixed by the product spec. Do not re-balance without changing the spec.

export function scoreOpportunity(item: IntelligenceItem): {
  score: number; breakdown: ScoreBreakdown[];
} {
  const hay = `${item.title} ${item.summary}`;
  const f = item.funding;
  const m = item.marketing;

  const fundingRecency = f?.announcedAt ? recency01(f.announcedAt, 10) : (item.type === "funding" ? 0.4 : 0);
  const marketingActivity = m
    ? (m.activityLevel === "HIGH" ? 1 : m.activityLevel === "ELEVATED" ? 0.7 : 0.45)
    : (/\b(launch|campaign|ambassador)\b/i.test(hay) ? 0.4 : 0.15);
  const creatorCompat = CREATOR_RE.test(hay) ? 0.9 : /\bapp|product|consumer\b/i.test(hay) ? 0.55 : 0.25;
  const consumerRelevance = CONSUMER_RE.test(hay) ? 0.9 : 0.35;
  const audienceOverlap = item.region === "IN" ? 0.9 : item.region === "GLOBAL" ? 0.55 : 0.45;
  const launchTiming = /\b(launch|unveil|debut|rolls? out|goes live|enters)\b/i.test(hay) ? 0.95 : 0.4;
  const socialMomentum = clamp01((item.trendScore ?? 45) / 100);

  const breakdown: ScoreBreakdown[] = [
    pts("Funding recency", 20, fundingRecency, f?.announcedAt ? `Announced ${Math.round(daysAgo(f.announcedAt))}d ago` : "No recent round on record"),
    pts("Marketing activity", 20, marketingActivity, m ? `${m.signals.length} observable signal${m.signals.length === 1 ? "" : "s"}` : "No campaign activity observed"),
    pts("Creator compatibility", 20, creatorCompat, creatorCompat > 0.8 ? "Demonstrable on short-form video" : "Harder to show on camera"),
    pts("Consumer relevance", 15, consumerRelevance, consumerRelevance > 0.5 ? "Consumer-facing product" : "B2B or infrastructure"),
    pts("Audience overlap", 10, audienceOverlap, item.region === "IN" ? "Core India audience" : "Partial overlap"),
    pts("Launch timing", 10, launchTiming, launchTiming > 0.8 ? "Actively launching now" : "No launch window detected"),
    pts("Social momentum", 5, socialMomentum, `Trend score ${item.trendScore ?? "—"}`),
  ];

  return { score: breakdown.reduce((a, b) => a + b.value, 0), breakdown };
}

// ── Relevance, novelty and confidence ─────────────────────────────────────────

/**
 * How much this item has to do with why the product exists: creators, brands
 * and the consumers they sell to.
 *
 * The gate below matters more than the weights. The previous version started
 * every item at 0.25 and added 0.15 for being Indian, so anything published in
 * India cleared the 0.35 filter on origin alone — which is how army-recruitment
 * search trends and quarterly-results coverage reached a brief written for an
 * influencer-marketing desk. Subject comes first; region and corroboration
 * only strengthen an item that is already on topic.
 */
export function relevance(c: Cluster): number {
  const hay = `${c.primary.title} ${c.primary.summary}`;
  const creator = CREATOR_RE.test(hay);
  const brand = BRAND_RE.test(hay);
  const consumer = CONSUMER_RE.test(hay);

  // Sources that MEASURE what is being watched or searched are on topic by
  // definition — a ranked view count or a search spike is content performance,
  // which is the subject of the product. Requiring creator/brand vocabulary of
  // them was why a meme spiking across India could never appear: "Ravi Kishan"
  // contains no marketing words, and the gate below dropped it to zero.
  const measured =
    c.primary.sourceType === "trend-index" ||
    c.primary.platform === "google-trends" ||
    c.primary.platform === "youtube" && c.primary.sourceType === "platform-announcement";

  if (measured) {
    // Utility searches are not culture. Weather, exam results and login
    // queries spike constantly and mean nothing to this desk.
    if (UTILITY_SEARCH_RE.test(hay)) return 0;
    // A search spike only counts when it is a culture moment. Ranked YouTube
    // view counts are exempt: those ARE content, whatever the subject.
    const rankedContent = c.primary.platform === "youtube";
    if (!rankedContent && !CULTURE_RE.test(hay)) return 0;
    let m = 0.5;
    if (creator) m += 0.2;
    if (brand || consumer) m += 0.1;
    if (c.primary.region === "IN") m += 0.1;
    return clamp01(m);
  }

  // No creator, brand or consumer signal at all — not this product's subject,
  // however recent, well-sourced or local it is.
  if (!creator && !brand && !consumer) return 0;

  let r = 0.15;
  if (creator) r += 0.3;
  if (brand) r += 0.2;
  if (consumer) r += 0.15;
  if (c.primary.region === "IN") r += 0.1;
  if (c.sources.length > 1) r += 0.1;
  return clamp01(r);
}

export function novelty(c: Cluster, seenBefore: boolean, sourceCountBefore: number): number {
  if (!seenBefore) return 1;
  if (c.sources.length > sourceCountBefore) return 0.65; // materially updated
  return clamp01(0.25 - daysAgo(c.primary.publishedAt) * 0.05);
}

export function confidence(c: Cluster): { value: number; label: "High" | "Medium" | "Low" } {
  const bestTier = Math.min(...c.sources.map((s) => SOURCE_TIER[s.type]));
  const independent = new Set(c.sources.map((s) => s.name)).size;
  const dated = c.sources.filter((s) => s.publishedAt).length;

  let v = 0.3;
  v += bestTier <= 2 ? 0.35 : bestTier <= 4 ? 0.22 : bestTier <= 5 ? 0.12 : 0;
  v += Math.min(0.25, (independent - 1) * 0.12);
  v += dated > 0 ? 0.1 : 0;
  const value = clamp01(v);
  return { value, label: value >= 0.72 ? "High" : value >= 0.48 ? "Medium" : "Low" };
}

/**
 * What we are permitted to claim. A community post is never "REPORTED",
 * and a trend index reading is never attributed to a social platform.
 */
export function signalLabel(c: Cluster): IntelligenceItem["signalLabel"] {
  const tiers = c.sources.map((s) => SOURCE_TIER[s.type]);
  const best = Math.min(...tiers);
  const independent = new Set(c.sources.map((s) => s.name)).size;

  // A company's own announcement, or two independent publications agreeing,
  // is something we can call reported. One trade story on its own is not.
  if (best <= 2) return "REPORTED";
  if (best <= 5 && independent >= 2) return "REPORTED";
  if (c.primary.platform === "reddit" || c.primary.sourceType === "public-social") return "SOCIAL SIGNAL";
  if (c.primary.platform === "google-trends") return "PUBLIC WEB SIGNAL";
  if (best >= 7) return "EARLY SIGNAL";
  return "PUBLIC WEB SIGNAL";
}

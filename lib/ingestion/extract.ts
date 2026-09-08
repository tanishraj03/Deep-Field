import type { Category, FundingFacts, ItemType, MarketingFacts, RawItem, Region } from "@/lib/types";
import { guessCompany } from "@/lib/dedup";

// ── Classification ────────────────────────────────────────────────────────────
// Plain TypeScript, no model call. The AI budget is reserved for interpretation.

/**
 * Funding detection is deliberately two-part.
 *
 * "bags", "secures", "closes", "nets" and "lands" are ordinary English before
 * they are finance. On their own they filed "Hashtag Orange bags marketing
 * mandate for Frankfinn" and "Salil Gandhi joins Nykaa" as funding events. So
 * a raise verb only counts when the sentence also carries money or a named
 * round — the two things a real funding story cannot omit.
 */
const RAISE_VERB_RE = /\b(raises?|raised|bags?|secures?|closes?|nets?|mops? up|lands?|picks? up|garners?)\b/i;
const FUNDING_CONTEXT_RE = /\b(funding round|seed round|series\s+[a-j]\b|pre-?seed|angel round|bridge round|venture round|led by|valuation|pre-money|post-money|funding|investment)\b/i;
const MONEY_RE = /(?:[$₹€£]\s?\d|\b(?:rs\.?|inr|usd|eur|gbp)\s?\d|\b\d+(?:[.,]\d+)?\s?(?:million|billion|crore|lakh|mn|bn|cr)\b)/i;
const ACQUIRE_RE = /\bacqui(?:res?|red|sition)\b/i;

/** A funding EVENT, not merely a sentence containing a finance-shaped word. */
function isFundingEvent(hay: string): boolean {
  const money = MONEY_RE.test(hay);
  const round = FUNDING_CONTEXT_RE.test(hay);
  if (/\b(raises?|raised)\b/i.test(hay) && (money || round)) return true;
  if (RAISE_VERB_RE.test(hay) && round && money) return true;
  if (ACQUIRE_RE.test(hay) && money) return true;
  if (/\binvests?\b/i.test(hay) && money) return true;
  return false;
}
const MARKETING_RE = /\b(campaign|brand ambassador|ambassador|sponsors?(?:hip)?|launches?|unveils?|rebrand|advert|advertis|creative|agency|mandate|activation|ooh|billboard|influencer|creator[- ]led|collab|partnership|festive|ipl|world cup|jingle|film|tvc|媒体)/i;
const TREND_RE = /\b(trend(?:ing|s)?|viral|meme|format|challenge|audio|sound|aesthetic|slang|reels?|shorts?|algorithm|feed change|creators? are|gen ?z|fandom)/i;
const NOISE_RE = /\b(horoscope|weather forecast|match preview|live score|obituary|lottery|recipe of the day)\b/i;

/**
 * Community feeds carry a lot that is not intelligence: job ads, "rate my
 * idea", self-promotion and weekly stickies. A hiring post for a social media
 * intern is not a content trend, so it is filtered at the door rather than
 * being scored and shown as one.
 */
const COMMUNITY_NOISE_RE = /^\s*(\[?(hiring|for hire|job|jobs)\]?\b|\[?(help|advice|question|discussion|rant|vent|meta)\]?\s*[:\-]|(bi-?|fort)?weekly\b|monthly\b|daily\b|megathread|.*\bdiscussion (thread|&|and)\b|what are you working on|rate my|roast my|feedback (on|please)|self[- ]promo)/i;

/**
 * Commentary, not events. A publication's advice column, explainer or listicle
 * is not something that happened, so it cannot be a funding event or a
 * marketing move. Checked only after the funding test has had its say, so a real
 * round reported under an explainer-style headline still lands correctly.
 */
const EDITORIAL_RE = /^\s*(how |why |what |when |where |who )|\b(guide to|a guide|tips?\b|lessons?\b|explainer|explained|opinion|op-ed|deep ?dive|roundup|round-up|digest|newsletter|webinar|masterclass|interview|podcast|top \d+|best \d+|\d+ (things|ways|reasons|lessons|trends)|vs\.?\s|versus)\b/i;

export function classify(item: RawItem, lane: string): ItemType | null {
  const hay = `${item.title} ${item.summary}`;
  if (NOISE_RE.test(hay)) return null;
  if (item.sourceType === "community" && COMMUNITY_NOISE_RE.test(item.title)) return null;
  if (isFundingEvent(hay)) return "funding";

  // Commentary is not an event — but only the funding and marketing lanes are
  // asking "what happened". In the social and platform lanes, analysis of a
  // format or a platform change IS the signal ("Why short-form audio is
  // shifting", "How creators are using X"), so the editorial filter is not
  // applied there or it silences the trend lane entirely.
  const wantsEvents = lane === "funding" || lane === "marketing";
  if (wantsEvents && EDITORIAL_RE.test(item.title)) return null;

  if (lane === "marketing" && MARKETING_RE.test(hay)) return "marketing";
  if (MARKETING_RE.test(hay) && !TREND_RE.test(hay)) return "marketing";
  if (TREND_RE.test(hay) || lane === "social" || lane === "platform") return "trend";

  // No catch-all. This used to end `if (lane === "funding") return "funding"`,
  // which made every article a funding publication printed — opinion pieces,
  // interviews, quarterly-results coverage — into a "funding event". An item
  // that shows no sign of being a funding, marketing or trend event is not
  // one, whichever feed it arrived on.
  return null;
}

// ── Funding facts ─────────────────────────────────────────────────────────────
// Every number below is READ from source text. Nothing is inferred, estimated,
// converted from a guess, or filled in. If it is not written down, it is null.

const USD_RE = /(?:US)?\$\s?([\d,.]+)\s?(million|mn|m|billion|bn|b|k)?\b/i;
const INR_CR_RE = /(?:₹|Rs\.?|INR)\s?([\d,.]+)\s?(crore|cr|lakh|lakhs)\b/i;
const ROUND_RE = /\b(pre-?seed|seed|series\s+[a-j]|bridge|pre-?series\s+[a-j]|growth|venture|strategic|debt|angel)\b/i;
const INVESTOR_RE = /\bled by ([^.,;]{3,80}?)(?:\s+(?:with|and|alongside)\b|[.,;]|$)/i;
const PARTICIPATION_RE = /\b(?:participation from|joined by|along with) ([^.]{3,120}?)(?:[.;]|$)/i;

/** Approximate INR→USD only to make amounts sortable. Display always uses amountRaw. */
const INR_PER_USD = 88;
/** Same caveat: sorting only, never shown. */
const PER_USD: Record<string, number> = { "€": 0.92, "£": 0.79 };

/**
 * A money figure sitting in one of these clauses does not describe the size of
 * the round being reported, even though it is genuinely in the source text.
 *
 * This is the difference between "read from source" and "correct". DaMENSCH's
 * story reads "raises fresh funding at flat valuation of Rs 600 Cr … In May
 * 2024, the company had raised Rs 21.62 crore (approximately $2.5 million)".
 * Taking the first match gave $2.5 million — a 2024 round — reported as today's
 * amount and flagged disclosed. A wrong number carrying a citation is worse
 * than an honest null, which is what this now produces.
 */
const VALUATION_RE = /\b(valuation|valued at|pre-money|post-money|market cap|worth)\b/i;
const HISTORICAL_RE = /\b(had (?:raised|secured|closed)|previously|last (?:year|month|round)|earlier (?:this|in)|to date|so far|cumulative|since inception|in \d{4}|in (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{4})/i;

interface MoneyHit { raw: string; usd: number; index: number }

/** Every money figure in the text, in order, with where it was found. */
function moneyHits(text: string): MoneyHit[] {
  const out: MoneyHit[] = [];
  const push = (raw: string, usd: number, index: number) => {
    if (Number.isFinite(usd)) out.push({ raw: raw.trim(), usd, index });
  };
  const unitMult = (u: string) =>
    /^(m|mn|million)$/i.test(u) ? 1e6 : /^(b|bn|billion)$/i.test(u) ? 1e9 : /^k$/i.test(u) ? 1e3 : 1;

  const major = /(?:US)?([$€£])\s?([\d,.]+)\s?(million|mn|m|billion|bn|b|k)?\b/gi;
  for (const m of text.matchAll(major)) {
    const base = parseFloat(m[2].replace(/,/g, ""));
    const inUnits = base * unitMult(m[3] ?? "");
    push(m[0], m[1] === "$" ? inUnits : inUnits / (PER_USD[m[1]] ?? 1), m.index ?? 0);
  }
  const inr = /(?:₹|Rs\.?|INR)\s?([\d,.]+)\s?(crore|cr|lakh|lakhs)\b/gi;
  for (const m of text.matchAll(inr)) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    const rupees = base * (/^cr/i.test(m[2]) ? 1e7 : 1e5);
    push(m[0], rupees / INR_PER_USD, m.index ?? 0);
  }
  return out.sort((a, b) => a.index - b.index);
}

/** The first money figure that is actually about this round. */
function roundAmount(text: string): MoneyHit | null {
  for (const hit of moneyHits(text)) {
    const before = text.slice(Math.max(0, hit.index - 60), hit.index);
    const around = text.slice(Math.max(0, hit.index - 140), hit.index + 40);
    if (VALUATION_RE.test(before)) continue;
    if (HISTORICAL_RE.test(around)) continue;
    return hit;
  }
  return null;
}

export function extractFunding(item: RawItem): FundingFacts {
  const hay = `${item.title}. ${item.summary}`;
  // The headline is checked on its own first: a figure in the title is about
  // the event being reported, and it keeps the currency the publication led
  // with rather than a USD conversion printed in parentheses further down.
  const hit = roundAmount(item.title) ?? roundAmount(hay);
  const amountUsd: number | null = hit ? Math.round(hit.usd) : null;
  const amountRaw: string | null = hit ? hit.raw : null;

  const investors: string[] = [];
  const led = hay.match(INVESTOR_RE);
  if (led) investors.push(...splitNames(led[1]));
  const part = hay.match(PARTICIPATION_RE);
  if (part) investors.push(...splitNames(part[1]));

  const round = hay.match(ROUND_RE)?.[0] ?? null;

  return {
    companyName: guessCompany(item.title) ?? item.sourceName,
    amountUsd,
    amountRaw,
    round: round ? titleCase(round) : null,
    investors: [...new Set(investors)].slice(0, 6),
    announcedAt: item.publishedAt,
    amountDisclosed: amountRaw !== null,
  };
}

function splitNames(s: string): string[] {
  return s.split(/,| and /i)
    .map((x) => x.replace(/\b(existing|new|other)\s+investors?\b/i, "").trim())
    .filter((x) => x.length > 2 && x.length < 48 && /[A-Za-z]/.test(x))
    .map(titleCase);
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).trim();
}

// ── Marketing facts ───────────────────────────────────────────────────────────
// Note what we can SEE. Never state a spend figure unless a source printed one.

const SIGNAL_MAP: { re: RegExp; label: string }[] = [
  { re: /\bcampaign\b/i, label: "Campaign" },
  { re: /\b(brand )?ambassador|face of\b/i, label: "Celebrity" },
  { re: /\bsponsor|title sponsor|jersey\b/i, label: "Sponsorship" },
  { re: /\b(ooh|billboard|hoarding|out-?of-?home)\b/i, label: "OOH" },
  { re: /\b(influencer|creator[- ]led|ugc)\b/i, label: "Creator campaign" },
  { re: /\b(instagram|reels)\b/i, label: "Instagram" },
  { re: /\b(youtube|shorts)\b/i, label: "YouTube" },
  { re: /\b(tvc|television|tv ad)\b/i, label: "TV" },
  { re: /\b(launch(?:es|ed)?|unveils?|debuts?)\b/i, label: "Product launch" },
  { re: /\b(agency|mandate|account win)\b/i, label: "Agency appointment" },
  { re: /\b(cmo|marketing head|chief marketing)\b/i, label: "Marketing hire" },
  { re: /\b(festive|diwali|ipl|world cup|holi)\b/i, label: "Seasonal push" },
  { re: /\b(enters|expands into|new market)\b/i, label: "Market expansion" },
];

/** Only matches when a publication explicitly reports a figure spent on marketing. */
const REPORTED_SPEND_RE =
  /\b(?:spen[dt]|budget|outlay|ad spend|marketing spend)\b[^.]{0,40}?((?:₹|Rs\.?|\$)\s?[\d,.]+\s?(?:crore|cr|lakh|million|mn|bn|billion)?)/i;

export function extractMarketing(item: RawItem): MarketingFacts {
  const hay = `${item.title}. ${item.summary}`;
  const signals = SIGNAL_MAP.filter((s) => s.re.test(hay)).map((s) => s.label);
  const reported = hay.match(REPORTED_SPEND_RE);

  const activityLevel: MarketingFacts["activityLevel"] =
    signals.length >= 4 ? "HIGH" : signals.length >= 2 ? "ELEVATED" : "NOTABLE";

  return {
    companyName: guessCompany(item.title) ?? item.sourceName,
    activityLevel,
    signals: [...new Set(signals)].slice(0, 6),
    spendReported: reported ? { amountRaw: reported[1].trim(), sourceUrl: item.url } : null,
  };
}

// ── Region and category inference ─────────────────────────────────────────────

const IN_RE = /\b(india|indian|bengaluru|bangalore|mumbai|delhi|gurugram|noida|hyderabad|chennai|pune|₹|rupee|crore|lakh|desi|bharat)\b/i;

export function inferRegion(item: RawItem): Region {
  if (IN_RE.test(`${item.title} ${item.summary}`)) return "IN";
  return item.region;
}

const CATEGORY_RE: [Category, RegExp][] = [
  ["AI", /\b(ai|artificial intelligence|llm|genai|model|agentic)\b/i],
  ["Fintech", /\b(fintech|payments?|upi|lending|neobank|insurtech)\b/i],
  ["D2C", /\b(d2c|direct[- ]to[- ]consumer|quick commerce|q-?commerce)\b/i],
  ["Beauty", /\b(beauty|skincare|cosmetic|makeup|grooming)\b/i],
  ["Fashion", /\b(fashion|apparel|streetwear|footwear|jewellery)\b/i],
  ["Food", /\b(food|beverage|snack|restaurant|cloud kitchen|coffee)\b/i],
  ["Gaming", /\b(gaming|esports|game studio|mobile game)\b/i],
  ["Fitness", /\b(fitness|gym|wellness|nutrition|protein)\b/i],
  ["Edtech", /\b(edtech|learning|upskilling|coaching)\b/i],
  ["Healthtech", /\b(healthtech|clinic|diagnostic|telemedicine|pharma)\b/i],
  ["Mobility", /\b(mobility|ev\b|scooter|ride[- ]hailing|logistics)\b/i],
  ["Creator Economy", /\b(creator|influencer|ugc|podcast|newsletter)\b/i],
  ["Music", /\b(music|song|album|audio|spotify|artist)\b/i],
  ["Entertainment", /\b(ott|film|series|streaming|bollywood|cinema)\b/i],
  ["Finance", /\b(funding|investor|vc|valuation|ipo)\b/i],
  ["SaaS", /\b(saas|b2b software|enterprise software)\b/i],
  ["Developer Tools", /\b(developer|api|sdk|open source)\b/i],
  ["Consumer", /\b(consumer|shopper|retail|app users)\b/i],
];

export function inferCategories(item: RawItem): Category[] {
  const hay = `${item.title} ${item.summary}`;
  const found = CATEGORY_RE.filter(([, re]) => re.test(hay)).map(([c]) => c);
  return [...new Set([...found, ...item.categories])].slice(0, 4);
}

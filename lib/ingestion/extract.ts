import type { Category, FundingFacts, ItemType, MarketingFacts, RawItem, Region } from "@/lib/types";
import { guessCompany } from "@/lib/dedup";

// ── Classification ────────────────────────────────────────────────────────────
// Plain TypeScript, no model call. The AI budget is reserved for interpretation.

const FUNDING_RE = /\b(raises?|raised|bags?|secures?|closes?|nets?|mops? up|funding round|seed round|series\s+[a-j]\b|pre-?seed|led by|valuation|acqui(?:res?|sition)|invests?\s+\$)/i;
const MARKETING_RE = /\b(campaign|brand ambassador|ambassador|sponsors?(?:hip)?|launches?|unveils?|rebrand|advert|advertis|creative|agency|mandate|activation|ooh|billboard|influencer|creator[- ]led|collab|partnership|festive|ipl|world cup|jingle|film|tvc|媒体)/i;
const TREND_RE = /\b(trend(?:ing|s)?|viral|meme|format|challenge|audio|sound|aesthetic|slang|reels?|shorts?|algorithm|feed change|creators? are|gen ?z|fandom)/i;
const NOISE_RE = /\b(horoscope|weather forecast|match preview|live score|obituary|lottery|recipe of the day)\b/i;

export function classify(item: RawItem, lane: string): ItemType | null {
  const hay = `${item.title} ${item.summary}`;
  if (NOISE_RE.test(hay)) return null;
  if (FUNDING_RE.test(hay)) return "funding";
  if (lane === "marketing" && MARKETING_RE.test(hay)) return "marketing";
  if (MARKETING_RE.test(hay) && !TREND_RE.test(hay)) return "marketing";
  if (TREND_RE.test(hay) || lane === "social" || lane === "platform") return "trend";
  if (lane === "funding") return "funding";
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

export function extractFunding(item: RawItem): FundingFacts {
  const hay = `${item.title}. ${item.summary}`;
  let amountUsd: number | null = null;
  let amountRaw: string | null = null;

  const usd = hay.match(USD_RE);
  if (usd) {
    const base = parseFloat(usd[1].replace(/,/g, ""));
    const unit = (usd[2] ?? "").toLowerCase();
    const mult = /^(m|mn|million)$/.test(unit) ? 1e6
      : /^(b|bn|billion)$/.test(unit) ? 1e9
      : unit === "k" ? 1e3 : 1;
    if (Number.isFinite(base)) { amountUsd = base * mult; amountRaw = usd[0].trim(); }
  } else {
    const inr = hay.match(INR_CR_RE);
    if (inr) {
      const base = parseFloat(inr[1].replace(/,/g, ""));
      const unit = inr[2].toLowerCase();
      const rupees = base * (unit.startsWith("cr") ? 1e7 : 1e5);
      if (Number.isFinite(rupees)) { amountUsd = rupees / INR_PER_USD; amountRaw = inr[0].trim(); }
    }
  }

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

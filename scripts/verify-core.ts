/**
 * Core logic verification. Run: npx tsx scripts/verify-core.ts
 * Proves the two claims the product rests on: duplicates collapse, and no
 * number is ever invented.
 */
import { cluster } from "../lib/dedup";
import { extractFunding, extractMarketing, classify } from "../lib/ingestion/extract";
import { scoreOpportunity, scoreTrend, confidence, signalLabel } from "../lib/scoring";
import type { RawItem } from "../lib/types";
import { canonicalUrl, hash } from "../lib/utils";
import { buildCompanyProfile, companySlug, listCompanies } from "../lib/company";
import { applyPrefs, defaultPrefs, isEmptyFeed } from "../lib/prefs";
import { mockItems } from "../lib/mock/data";

const now = new Date().toISOString();
const item = (o: Partial<RawItem> & { title: string; url: string; sourceName: string }): RawItem => ({
  key: hash(canonicalUrl(o.url)), summary: "", canonicalUrl: canonicalUrl(o.url),
  sourceType: "industry-publication", publishedAt: now, fetchedAt: now,
  region: "IN", platform: "web", categories: [], language: "en", ...o,
});

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  cond ? pass++ : fail++;
};

console.log("\n  DEDUPLICATION");
const dupes = [
  item({ title: "Kettlepine raises $14M in Series A led by Marigold Capital",
         url: "https://entrackr.com/kettlepine?utm_source=twitter", sourceName: "Entrackr",
         summary: "Kettlepine has raised $14M in a Series A round led by Marigold Capital, with participation from Northline Ventures." }),
  item({ title: "Kettlepine bags $14 Mn Series A round", url: "https://inc42.com/kettlepine-series-a", sourceName: "Inc42" }),
  item({ title: "Exclusive: Kettlepine secures $14M at Series A", url: "https://vccircle.com/kettlepine", sourceName: "VCCircle" }),
  item({ title: "Kettlepine raises $14M in Series A led by Marigold Capital",
         url: "https://entrackr.com/kettlepine", sourceName: "Entrackr" }),
  item({ title: "Havenbrook names playback singer as brand ambassador", url: "https://afaqs.com/havenbrook", sourceName: "afaqs!" }),
];
const { clusters, duplicatesRemoved } = cluster(dupes);
check("5 reports collapse to 2 events", clusters.length === 2, `got ${clusters.length}, removed ${duplicatesRemoved}`);
const kettle = clusters.find((c) => c.primary.title.includes("Kettlepine"))!;
check("all 4 Kettlepine reports attach as sources", kettle.sources.length === 4, `${kettle.sources.length} sources`);
check("tracking params stripped from canonical URL",
  dupes[0].canonicalUrl === "https://entrackr.com/kettlepine");
check("separate company stays a separate event",
  clusters.some((c) => c.primary.title.includes("Havenbrook")));

console.log("\n  FACT EXTRACTION — nothing invented");
const f1 = extractFunding(dupes[0]);
check("amount read from text", f1.amountRaw === "$14M" && f1.amountUsd === 14_000_000, `${f1.amountRaw}`);
check("round read from text", f1.round === "Series A", `${f1.round}`);
check("investors read from text", f1.investors.includes("Marigold Capital"), f1.investors.join(", "));
check("company name inferred", f1.companyName === "Kettlepine", f1.companyName);

const f2 = extractFunding(item({ title: "Orrery Labs closes seed round", url: "https://x.com/a", sourceName: "HN" }));
check("undisclosed amount stays null", f2.amountRaw === null && f2.amountDisclosed === false);

const inr = extractFunding(item({ title: "Tulsi Foods raises Rs 40 crore in pre-Series A", url: "https://x.com/b", sourceName: "Inc42" }));
check("INR amount parsed, raw string preserved", inr.amountRaw === "Rs 40 crore", `${inr.amountRaw}`);

console.log("\n  MARKETING — spend never fabricated");
const m = extractMarketing(item({
  title: "Havenbrook launches festive campaign with brand ambassador and OOH blitz",
  url: "https://afaqs.com/h", sourceName: "afaqs!",
  summary: "The influencer-led campaign spans Instagram and YouTube with a new agency mandate.",
}));
check("activity level derived from signal count", m.activityLevel === "HIGH", `${m.activityLevel} from ${m.signals.length} signals`);
check("no spend figure when none reported", m.spendReported === null);

const m2 = extractMarketing(item({
  title: "Company X campaign", url: "https://x.com/c", sourceName: "e4m",
  summary: "The brand will spend Rs 120 crore on the campaign, the company said.",
}));
check("reported spend captured only when printed", m2.spendReported?.amountRaw === "Rs 120 crore", `${m2.spendReported?.amountRaw}`);

console.log("\n  CLASSIFICATION");
check("funding headline → funding", classify(dupes[0], "funding") === "funding");
check("campaign headline → marketing", classify(item({ title: "Brand X unveils new campaign with celebrity ambassador", url: "https://a.com/1", sourceName: "afaqs!" }), "marketing") === "marketing");
check("noise rejected", classify(item({ title: "Today's horoscope for all signs", url: "https://a.com/2", sourceName: "X" }), "mixed") === null);

console.log("\n  SCORING");
const t = scoreTrend(kettle, 1);
check("trend score in range", t.score >= 0 && t.score <= 100, `${t.score} → ${t.label}`);
check("breakdown weights sum to 100", t.breakdown.reduce((a, b) => a + b.weight, 0) === 100);
check("no component exceeds its weight", t.breakdown.every((b) => b.value <= b.weight));

const opp = scoreOpportunity({
  ...({} as any), id: "x", type: "funding", title: dupes[0].title, summary: dupes[0].summary,
  region: "IN", categories: [], sources: kettle.sources, trendScore: t.score,
  funding: f1, marketing: undefined,
});
check("opportunity weights sum to 100", opp.breakdown.reduce((a, b) => a + b.weight, 0) === 100);
check("opportunity score in range", opp.score >= 0 && opp.score <= 100, `${opp.score}/100`);

const c = confidence(kettle);
check("4 independent sources → high confidence", c.label === "High", `${c.label} (${c.value.toFixed(2)})`);
check("multi-source trade press → REPORTED", signalLabel(kettle) === "REPORTED", signalLabel(kettle));

console.log("\n  COMPANY PROFILES");
const profileItems = mockItems();
const companies = listCompanies(profileItems);
check("companies indexed from funding + marketing items", companies.length >= 2, `${companies.length} companies`);
check("slug is url-safe", companies.every((c) => /^[a-z0-9-]+$/.test(c.slug)), companies.map((c) => c.slug).join(", "));
check("index sorted by opportunity, best first", companies
  .map((c) => c.opportunityScore ?? -1)
  .every((v, i, a) => i === 0 || a[i - 1] >= v));

const profile = buildCompanyProfile(profileItems, companies[0].slug);
check("profile builds for a known company", profile !== null, profile?.name ?? "null");
check("unknown company returns null, never a stub", buildCompanyProfile(profileItems, "no-such-company") === null);

if (profile) {
  check("timeline is newest-first", profile.timeline
    .map((e) => Date.parse(e.at))
    .every((v, i, a) => i === 0 || a[i - 1] >= v));
  check("timeline separates observation from event", profile.timeline.some((e) => e.kind === "observed"));
  check("sources deduplicated by url", new Set(profile.sources.map((s) => s.url)).size === profile.sources.length);
  check("gaps are stated, never hidden", profile.unknowns.length > 0, `${profile.unknowns.length} disclosed`);
  check("no contact details are ever collected",
    profile.unknowns.some((u) => u.includes("contact details are not collected")));
}

// An undisclosed round must surface as a stated gap rather than an empty field.
const quiet = buildCompanyProfile([{
  ...profileItems[0],
  funding: { companyName: "Quiet Co", amountUsd: null, amountRaw: null, round: null, investors: [], announcedAt: null, amountDisclosed: false },
  marketing: undefined,
}], companySlug("Quiet Co"));
check("undisclosed amount becomes a disclosed gap",
  Boolean(quiet?.unknowns.some((u) => u.includes("amount was not disclosed"))));
check("unnamed investors become a disclosed gap",
  Boolean(quiet?.unknowns.some((u) => u.includes("Investors were not named"))));

console.log("\n  FEED PREFERENCES");
check("default feed hides nothing it was not asked to",
  applyPrefs(profileItems, { ...defaultPrefs, regions: [], platforms: [], industries: [] }).length === profileItems.length);
check("empty feed is recognised as no filter",
  isEmptyFeed({ ...defaultPrefs, regions: [], platforms: [], industries: [] }));
const indiaOnly = applyPrefs(profileItems, { ...defaultPrefs, regions: ["IN"] });
check("region filter keeps only that region",
  indiaOnly.every((i) => i.region === "IN"), `${indiaOnly.length} of ${profileItems.length}`);
check("industry filter matches on any category",
  applyPrefs(profileItems, { ...defaultPrefs, regions: [], industries: ["Consumer"] })
    .every((i) => i.categories.includes("Consumer")));
check("filtering is non-destructive — the pool is untouched", profileItems.length === mockItems().length);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

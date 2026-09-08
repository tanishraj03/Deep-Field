import type { IntelligenceItem, ScoreBreakdown, SyncRun } from "@/lib/types";
import { hash } from "@/lib/utils";

/**
 * Mock mode exists so the interface can be built and reviewed with zero keys.
 *
 * Every company below is INVENTED. Names are deliberately synthetic so that no
 * one can mistake a demo card for a real funding event. The UI shows a MOCK
 * badge whenever this data is in use, and MOCK_DATA=false removes both.
 */

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

function bd(parts: [string, number, number, string][]): ScoreBreakdown[] {
  return parts.map(([label, weight, value, note]) => ({ label, weight, value, note }));
}

const base = {
  duplicatesMerged: 0,
  isNew: true,
  isUpdate: false,
  scoreIsEstimated: true,
} as const;

export function mockItems(): IntelligenceItem[] {
  const items: IntelligenceItem[] = [
    {
      ...base,
      id: hash("mock-trend-1"),
      type: "trend",
      title: "Desk-tour edits are being cut to voice notes instead of music",
      summary:
        "Creators across India are replacing licensed audio in room and desk tours with their own voice notes, sidestepping music copyright flags and producing a more confessional tone. The format is appearing on Reels and Shorts within days of each other.",
      sourceUrl: "https://example.com/mock/voice-note-edits",
      sourceName: "Social Samosa",
      publishedAt: hoursAgo(9),
      firstSeenAt: hoursAgo(9),
      lastUpdatedAt: hoursAgo(1),
      region: "IN",
      platform: "instagram",
      categories: ["Creator Economy", "Culture"],
      confidence: 0.66, confidenceLabel: "Medium", relevance: 0.88, novelty: 1,
      sources: [
        { name: "Social Samosa", url: "https://example.com/mock/voice-note-edits", type: "industry-publication", publishedAt: hoursAgo(9) },
        { name: "r/IndiaSocial", url: "https://example.com/mock/reddit-thread", type: "community", publishedAt: hoursAgo(14) },
        { name: "Tubefilter", url: "https://example.com/mock/tubefilter", type: "industry-publication", publishedAt: hoursAgo(20) },
      ],
      duplicatesMerged: 4,
      signalLabel: "SOCIAL SIGNAL",
      trendScore: 91, trendLabel: "BREAKOUT",
      trendBreakdown: bd([
        ["Recency", 25, 24, "Published 9h ago"],
        ["Growth rate", 20, 17, "1 → 3 independent mentions"],
        ["Independent sources", 20, 15, "3 distinct domains"],
        ["Cross-platform spread", 10, 7, "Seen on 3 platforms"],
        ["Geographic relevance", 10, 10, "India-relevant"],
        ["Creator relevance", 10, 10, "Creator-shaped language present"],
        ["Brand relevance", 5, 4, "Brand activation possible"],
      ]),
      analysis: {
        whatHappened: "Room and desk tour videos are being cut to creator voice notes rather than trending audio. The shift shows up on Reels and Shorts in the same week, mostly from creators between 10k and 200k followers.",
        whyItsMoving: "Voice-over edits avoid music rights flags and reward writing over song selection, which lowers the production bar for smaller accounts.",
        creatorOpportunity: "Any creator with a workspace, hostel room or studio can produce one in an evening with no licensed audio.",
        brandOpportunity: "Furniture, stationery, audio hardware and productivity apps can appear as objects in frame without a scripted read.",
        whyWeCare: "",
        veracity: "AI_INTERPRETATION",
        generatedBy: "gemini",
      },
    },
    {
      ...base,
      id: hash("mock-funding-1"),
      type: "funding",
      title: "Kettlepine raises $14M Series A to expand its AI recipe app across India",
      summary:
        "Kettlepine, a Bengaluru consumer AI company, has raised $14M in a Series A led by Marigold Capital with participation from Northline Ventures. The company says the round will fund a category expansion and a marketing push into Tier 2 cities.",
      sourceUrl: "https://example.com/mock/kettlepine",
      sourceName: "Entrackr",
      publishedAt: hoursAgo(6),
      firstSeenAt: hoursAgo(6),
      lastUpdatedAt: hoursAgo(2),
      region: "IN",
      platform: "web",
      categories: ["AI", "Consumer", "Food"],
      confidence: 0.84, confidenceLabel: "High", relevance: 0.92, novelty: 1,
      sources: [
        { name: "Entrackr", url: "https://example.com/mock/kettlepine", type: "industry-publication", publishedAt: hoursAgo(6) },
        { name: "Inc42", url: "https://example.com/mock/kettlepine-inc42", type: "industry-publication", publishedAt: hoursAgo(5) },
        { name: "Kettlepine blog", url: "https://example.com/mock/kettlepine-blog", type: "company-announcement", publishedAt: hoursAgo(7) },
      ],
      duplicatesMerged: 3,
      signalLabel: "REPORTED",
      funding: {
        companyName: "Kettlepine",
        amountUsd: 14_000_000,
        amountRaw: "$14M",
        round: "Series A",
        investors: ["Marigold Capital", "Northline Ventures"],
        announcedAt: hoursAgo(6),
        amountDisclosed: true,
      },
      opportunityScore: 92,
      opportunityBreakdown: bd([
        ["Funding recency", 20, 20, "Announced 0d ago"],
        ["Marketing activity", 20, 14, "Stated marketing push"],
        ["Creator compatibility", 20, 18, "Demonstrable on short-form video"],
        ["Consumer relevance", 15, 14, "Consumer-facing product"],
        ["Audience overlap", 10, 9, "Core India audience"],
        ["Launch timing", 10, 10, "Actively launching now"],
        ["Social momentum", 5, 3, "Trend score 62"],
      ]),
      creatorCategories: ["Food", "Tech", "Lifestyle", "Comedy"],
      pitchIdeas: [
        "A week of dinners planned entirely by the app, filmed by one food creator per city.",
        "A blind taste test between an app-generated recipe and a family recipe.",
      ],
      contactRoles: ["Head of Growth", "Brand Partnerships", "Founder"],
      analysis: {
        whatHappened: "Kettlepine builds a consumer AI recipe and meal-planning app aimed at Indian home kitchens.",
        whyItsMoving: "", creatorOpportunity: "", brandOpportunity: "",
        whyWeCare: "Recently funded consumer AI company entering a growth phase. The product is highly demonstrable on short-form video and the stated Tier 2 expansion suggests a regional creator budget is being formed now.",
        veracity: "AI_INTERPRETATION",
        generatedBy: "gemini",
      },
    },
    {
      ...base,
      id: hash("mock-marketing-1"),
      type: "marketing",
      title: "Havenbrook Beverages names a playback singer as brand ambassador ahead of festive season",
      summary:
        "Havenbrook Beverages has announced a brand ambassador and a multi-platform festive campaign spanning television, outdoor sites in four metros, and a creator programme. The company has also appointed a new creative agency.",
      sourceUrl: "https://example.com/mock/havenbrook",
      sourceName: "afaqs!",
      publishedAt: hoursAgo(11),
      firstSeenAt: hoursAgo(11),
      lastUpdatedAt: hoursAgo(3),
      region: "IN",
      platform: "web",
      categories: ["Consumer", "Media", "Food"],
      confidence: 0.78, confidenceLabel: "High", relevance: 0.86, novelty: 1,
      sources: [
        { name: "afaqs!", url: "https://example.com/mock/havenbrook", type: "industry-publication", publishedAt: hoursAgo(11) },
        { name: "exchange4media", url: "https://example.com/mock/havenbrook-e4m", type: "industry-publication", publishedAt: hoursAgo(10) },
      ],
      duplicatesMerged: 2,
      signalLabel: "REPORTED",
      marketing: {
        companyName: "Havenbrook Beverages",
        activityLevel: "HIGH",
        signals: ["Celebrity", "Campaign", "OOH", "Creator campaign", "Agency appointment", "Seasonal push"],
        spendReported: null,
      },
      opportunityScore: 88,
      opportunityBreakdown: bd([
        ["Funding recency", 20, 4, "No recent round on record"],
        ["Marketing activity", 20, 20, "6 observable signals"],
        ["Creator compatibility", 20, 18, "Demonstrable on short-form video"],
        ["Consumer relevance", 15, 14, "Consumer-facing product"],
        ["Audience overlap", 10, 9, "Core India audience"],
        ["Launch timing", 10, 10, "Actively launching now"],
        ["Social momentum", 5, 3, "Trend score 58"],
      ]),
      creatorCategories: ["Music", "Comedy", "Lifestyle", "Food", "Gen Z"],
      pitchIdeas: [
        "Regional-language cover versions of the campaign jingle by five music creators.",
        "A festive cooking series where the drink is the constant across every household.",
      ],
      contactRoles: ["Marketing", "Brand Partnerships", "Influencer Marketing", "PR"],
      analysis: {
        whatHappened: "Observable activity: an ambassador announcement, a multi-platform festive campaign, outdoor placements in four metros, a creator programme and a new agency appointment.",
        whyItsMoving: "Festive quarter budgets are committed early, and an agency appointment alongside an ambassador usually indicates a campaign that is funded rather than exploratory.",
        creatorOpportunity: "Regional-language music creators are an obvious fit given the ambassador choice.",
        brandOpportunity: "",
        whyWeCare: "Spend figure not publicly disclosed. Activity level inferred from six observable signals, not from a reported budget.",
        veracity: "AI_INTERPRETATION",
        generatedBy: "gemini",
      },
    },
    {
      ...base,
      id: hash("mock-trend-2"),
      type: "trend",
      title: "\"Second-hand haul\" videos climbing in Indian search interest",
      summary:
        "Google Trends shows rising India search interest for thrift and resale haul terms over the past week, alongside new resale communities forming on Reddit and Threads.",
      sourceUrl: "https://example.com/mock/thrift",
      sourceName: "Google Trends India",
      publishedAt: hoursAgo(18),
      firstSeenAt: hoursAgo(40),
      lastUpdatedAt: hoursAgo(4),
      region: "IN",
      platform: "google-trends",
      categories: ["Fashion", "Consumer", "Culture"],
      confidence: 0.6, confidenceLabel: "Medium", relevance: 0.74, novelty: 0.65,
      sources: [
        { name: "Google Trends India", url: "https://example.com/mock/thrift", type: "trend-index", publishedAt: hoursAgo(18) },
        { name: "r/IndiaSocial", url: "https://example.com/mock/thrift-reddit", type: "community", publishedAt: hoursAgo(22) },
      ],
      duplicatesMerged: 1,
      isNew: false,
      isUpdate: true,
      scoreIsEstimated: false,
      signalLabel: "PUBLIC WEB SIGNAL",
      trendScore: 78, trendLabel: "RISING",
      trendBreakdown: bd([
        ["Recency", 25, 18, "Published 18h ago"],
        ["Growth rate", 20, 14, "1 → 2 independent mentions"],
        ["Independent sources", 20, 10, "2 distinct domains"],
        ["Cross-platform spread", 10, 4, "Seen on 2 platforms"],
        ["Geographic relevance", 10, 10, "India-relevant"],
        ["Creator relevance", 10, 9, "Creator-shaped language present"],
        ["Brand relevance", 5, 4, "Brand activation possible"],
      ]),
      analysis: {
        whatHappened: "Search interest for thrift and resale haul terms in India has risen week on week, with new resale communities appearing on Reddit and Threads.",
        whyItsMoving: "Resale gives fashion creators fresh inventory to show without a brand gifting relationship, which keeps the format cheap to produce.",
        creatorOpportunity: "Fashion and styling creators can build a recurring weekly slot around a fixed budget.",
        brandOpportunity: "Resale marketplaces and laundry, care or storage brands can sponsor the format without it feeling like an ad read.",
        whyWeCare: "", veracity: "AI_INTERPRETATION", generatedBy: "gemini",
      },
    },
    {
      ...base,
      id: hash("mock-funding-2"),
      type: "funding",
      title: "Orrery Labs closes seed round for its creator analytics tool",
      summary:
        "Orrery Labs has closed a seed round for a cross-platform analytics tool aimed at mid-tier creators. Round size was not disclosed.",
      sourceUrl: "https://example.com/mock/orrery",
      sourceName: "Hacker News",
      publishedAt: hoursAgo(26),
      firstSeenAt: hoursAgo(26),
      lastUpdatedAt: hoursAgo(5),
      region: "GLOBAL",
      platform: "web",
      categories: ["Creator Economy", "SaaS"],
      confidence: 0.42, confidenceLabel: "Low", relevance: 0.68, novelty: 1,
      sources: [
        { name: "Hacker News", url: "https://example.com/mock/orrery", type: "community", publishedAt: hoursAgo(26) },
      ],
      signalLabel: "EARLY SIGNAL",
      funding: {
        companyName: "Orrery Labs",
        amountUsd: null, amountRaw: null, round: "Seed",
        investors: [], announcedAt: hoursAgo(26), amountDisclosed: false,
      },
      opportunityScore: 61,
      opportunityBreakdown: bd([
        ["Funding recency", 20, 18, "Announced 1d ago"],
        ["Marketing activity", 20, 3, "No campaign activity observed"],
        ["Creator compatibility", 20, 18, "Demonstrable on short-form video"],
        ["Consumer relevance", 15, 5, "B2B or infrastructure"],
        ["Audience overlap", 10, 6, "Partial overlap"],
        ["Launch timing", 10, 8, "No launch window detected"],
        ["Social momentum", 5, 3, "Trend score 54"],
      ]),
      creatorCategories: ["Tech", "Creator Economy", "Education"],
      contactRoles: ["Founder", "Growth"],
      analysis: {
        whatHappened: "Orrery Labs builds cross-platform analytics for mid-tier creators.",
        whyItsMoving: "", creatorOpportunity: "", brandOpportunity: "",
        whyWeCare: "Round size is Not publicly disclosed and the only source is a community post, so treat this as an early signal. Worth a watch rather than an approach.",
        veracity: "AI_INTERPRETATION", generatedBy: "gemini",
      },
    },
  ];
  return items;
}

export function mockRun(id: string, startedAt: string, count: number): SyncRun {
  return {
    id, startedAt, finishedAt: new Date().toISOString(),
    sourcesChecked: 33, sourcesFailed: 3,
    rawItems: 118, duplicatesRemoved: 57, newSignals: count,
    aiRequests: 7, aiSkipped: false,
    mode: "mock",
    runs: [
      { source: "Entrackr", ok: true, items: 14, ms: 640 },
      { source: "Social Samosa", ok: true, items: 11, ms: 720 },
      { source: "Google Trends India", ok: true, items: 20, ms: 410 },
      { source: "r/IndiaSocial", ok: false, items: 0, ms: 9000, error: "rate limited (429) — backing off until tomorrow" },
      { source: "Campaign India", ok: false, items: 0, ms: 9000, error: "HTTP 503" },
      { source: "Wamda", ok: false, items: 0, ms: 9000, error: "timeout" },
    ],
  };
}

export function mockBriefSections() {
  return {
    fiveThings: [
      "Voice-note desk tours are the fastest-moving India format this week, and it needs no licensed audio.",
      "Kettlepine raised $14M Series A and stated a Tier 2 marketing expansion — the clearest new budget on the board.",
      "Havenbrook Beverages has an ambassador, an agency and outdoor placements live before the festive quarter.",
      "Thrift haul search interest keeps climbing in India for a second week.",
      "Three sources were unavailable this morning, so India community coverage is thinner than usual.",
    ],
    whatsMoving: [
      "Voice-note desk tours — 91/100 BREAKOUT, three independent sources in nine hours.",
      "Thrift and resale hauls — 78/100 RISING, measured on Google Trends rather than estimated.",
    ],
    moneyMoves: [
      "Kettlepine — $14M Series A led by Marigold Capital, consumer AI, Bengaluru.",
      "Orrery Labs — seed round, size Not publicly disclosed, single community source.",
    ],
    whosSpending: [
      "Havenbrook Beverages — ambassador, festive campaign, OOH in four metros, new agency. Spend figure not disclosed.",
    ],
    whoToTalkTo: [
      "Kettlepine — 92/100. Funded this week, consumer AI, launching into new cities.",
      "Havenbrook Beverages — 88/100. Six live marketing signals and a creator programme already announced.",
      "Orrery Labs — 61/100. Early, undisclosed round. Watch rather than approach.",
    ],
    watch: [
      "Orrery Labs seed round — one community source only, no confirmation yet.",
    ],
  };
}

import type { SourceDefinition } from "./types";

/**
 * The free-source catalogue.
 *
 * Every entry is a publicly published feed or a documented keyless API.
 * Nothing here requires a key, a paid plan, a proxy or a scraping service.
 * Add or remove rows freely — the pipeline reads this list and nothing else.
 *
 * Tier order (highest provenance first) is expressed through `sourceType`.
 */
const S = (d: Omit<SourceDefinition, "enabled"> & { enabled?: boolean }): SourceDefinition => ({
  enabled: true, ...d,
});

export const SOURCES: SourceDefinition[] = [
  // ── Tier 3/4: official platform newsrooms. These are the only places we can
  //    honestly say "the platform announced this".
  S({ id: "meta-newsroom", name: "Meta Newsroom", url: "https://about.fb.com/news/feed/", kind: "rss",
      sourceType: "platform-announcement", region: "GLOBAL", platform: "instagram",
      categories: ["Creator Economy", "Technology"], lane: "platform" }),
  S({ id: "youtube-blog", name: "YouTube Official Blog", url: "https://blog.youtube/rss/", kind: "rss",
      sourceType: "platform-announcement", region: "GLOBAL", platform: "youtube",
      categories: ["Creator Economy", "Entertainment"], lane: "platform" }),
  S({ id: "tiktok-newsroom", name: "TikTok Newsroom", url: "https://newsroom.tiktok.com/en-us/rss.xml", kind: "rss",
      sourceType: "platform-announcement", region: "GLOBAL", platform: "tiktok",
      categories: ["Creator Economy", "Culture"], lane: "platform" }),
  S({ id: "reddit-blog", name: "Reddit Blog", url: "https://www.redditinc.com/blog/rss.xml", kind: "rss",
      sourceType: "platform-announcement", region: "GLOBAL", platform: "reddit",
      categories: ["Creator Economy", "Culture"], lane: "platform" }),

  // ── Funding, India first.
  S({ id: "entrackr", name: "Entrackr", url: "https://entrackr.com/rss", kind: "rss",
      sourceType: "industry-publication", region: "IN", platform: "web",
      categories: ["Technology", "Finance"], lane: "funding" }),
  S({ id: "inc42", name: "Inc42", url: "https://inc42.com/feed/", kind: "rss",
      sourceType: "industry-publication", region: "IN", platform: "web",
      categories: ["Technology", "Consumer"], lane: "funding" }),
  S({ id: "yourstory", name: "YourStory", url: "https://yourstory.com/feed", kind: "rss",
      sourceType: "industry-publication", region: "IN", platform: "web",
      categories: ["Technology", "Consumer"], lane: "funding" }),
  S({ id: "moneycontrol-startup", name: "Moneycontrol Startups",
      url: "https://www.moneycontrol.com/rss/technology.xml", kind: "rss",
      sourceType: "reputable-publication", region: "IN", platform: "web",
      categories: ["Finance", "Technology"], lane: "funding" }),

  // ── Funding, global.
  S({ id: "techcrunch", name: "TechCrunch", url: "https://techcrunch.com/feed/", kind: "rss",
      sourceType: "reputable-publication", region: "GLOBAL", platform: "web",
      categories: ["Technology", "AI"], lane: "funding" }),
  S({ id: "techcrunch-venture", name: "TechCrunch Venture",
      url: "https://techcrunch.com/category/venture/feed/", kind: "rss",
      sourceType: "reputable-publication", region: "GLOBAL", platform: "web",
      categories: ["Finance", "Technology"], lane: "funding" }),
  S({ id: "eu-startups", name: "EU-Startups", url: "https://www.eu-startups.com/feed/", kind: "rss",
      sourceType: "industry-publication", region: "EU", platform: "web",
      categories: ["Technology"], lane: "funding" }),
  S({ id: "wamda", name: "Wamda", url: "https://www.wamda.com/feed", kind: "rss",
      sourceType: "industry-publication", region: "ME", platform: "web",
      categories: ["Technology"], lane: "funding" }),

  // ── Marketing and brand activity.
  S({ id: "afaqs", name: "afaqs!", url: "https://www.afaqs.com/rss", kind: "rss",
      sourceType: "industry-publication", region: "IN", platform: "web",
      categories: ["Media", "Consumer"], lane: "marketing" }),
  S({ id: "socialsamosa", name: "Social Samosa", url: "https://www.socialsamosa.com/rss", kind: "rss",
      sourceType: "industry-publication", region: "IN", platform: "web",
      categories: ["Media", "Creator Economy"], lane: "marketing" }),
  S({ id: "marketingdive", name: "Marketing Dive", url: "https://www.marketingdive.com/feeds/news/", kind: "rss",
      sourceType: "industry-publication", region: "US", platform: "web",
      categories: ["Media", "Consumer"], lane: "marketing" }),
  S({ id: "adweek", name: "Adweek", url: "https://www.adweek.com/feed/", kind: "rss",
      sourceType: "industry-publication", region: "GLOBAL", platform: "web",
      categories: ["Media"], lane: "marketing" }),

  // ── Creator economy and culture.
  S({ id: "tubefilter", name: "Tubefilter", url: "https://www.tubefilter.com/feed/", kind: "rss",
      sourceType: "industry-publication", region: "GLOBAL", platform: "youtube",
      categories: ["Creator Economy", "Entertainment"], lane: "social" }),
  S({ id: "digiday", name: "Digiday", url: "https://digiday.com/feed/", kind: "rss",
      sourceType: "industry-publication", region: "GLOBAL", platform: "web",
      categories: ["Media", "Creator Economy"], lane: "marketing" }),

  // ── Community discussion. Early, noisy, explicitly labelled as such.
  S({ id: "r-india-startups", name: "r/StartUpIndia",
      url: "https://www.reddit.com/r/StartUpIndia/new.json?limit=25", kind: "reddit",
      sourceType: "community", region: "IN", platform: "reddit",
      categories: ["Technology", "Consumer"], lane: "mixed" }),
  S({ id: "r-indiasocial", name: "r/IndiaSocial",
      url: "https://www.reddit.com/r/IndiaSocial/hot.json?limit=25", kind: "reddit",
      sourceType: "community", region: "IN", platform: "reddit",
      categories: ["Culture", "Consumer"], lane: "social" }),
  S({ id: "r-influencermarketing", name: "r/InfluencerMarketing",
      url: "https://www.reddit.com/r/InfluencerMarketing/new.json?limit=25", kind: "reddit",
      sourceType: "community", region: "GLOBAL", platform: "reddit",
      categories: ["Creator Economy"], lane: "social" }),
  S({ id: "r-newtubers", name: "r/NewTubers",
      url: "https://www.reddit.com/r/NewTubers/hot.json?limit=25", kind: "reddit",
      sourceType: "community", region: "GLOBAL", platform: "reddit",
      categories: ["Creator Economy", "Entertainment"], lane: "social" }),
  S({ id: "r-socialmedia", name: "r/socialmedia",
      url: "https://www.reddit.com/r/socialmedia/hot.json?limit=25", kind: "reddit",
      sourceType: "community", region: "GLOBAL", platform: "reddit",
      categories: ["Creator Economy", "Media"], lane: "social" }),

  // ── Measured search interest.
  S({ id: "trends-in", name: "Google Trends India",
      url: "https://trends.google.com/trending/rss?geo=IN", kind: "trends",
      sourceType: "trend-index", region: "IN", platform: "google-trends",
      categories: ["Culture"], lane: "social" }),
  S({ id: "trends-us", name: "Google Trends US",
      url: "https://trends.google.com/trending/rss?geo=US", kind: "trends",
      sourceType: "trend-index", region: "US", platform: "google-trends",
      categories: ["Culture"], lane: "social" }),

  // ── Early product signal.
  S({ id: "hn-funding", name: "Hacker News",
      url: "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=raises%20funding&hitsPerPage=25",
      kind: "hn", sourceType: "community", region: "GLOBAL", platform: "web",
      categories: ["Technology", "AI"], lane: "funding" }),
  S({ id: "hn-launch", name: "Hacker News Launches",
      url: "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=launch%20consumer%20app&hitsPerPage=25",
      kind: "hn", sourceType: "community", region: "GLOBAL", platform: "web",
      categories: ["Consumer", "AI"], lane: "mixed" }),
];

/**
 * Removed 2026-09-08 after live verification — each was checked directly, not
 * assumed. None has a free replacement that is not a key, a paid plan or an
 * anti-bot bypass, all of which this project refuses.
 *
 *   LinkedIn Official Blog  blog.linkedin.com/feed and every /rss, /rss.xml,
 *                           /feed.xml variant serve HTML. LinkedIn no longer
 *                           publishes a blog feed.
 *   VCCircle                /rss/news serves HTML with HTTP 200; /feed and
 *                           /rss return HTTP 500. Feed retired.
 *   Tech in Asia            HTTP 403 from an AWS ELB on /feed, /rss and
 *                           /feed/rss. Body is a bare "403 Forbidden".
 *   Campaign India          /rss serves an HTML index whose own listed feed
 *                           URLs (RSS/rss.ashx) all return HTTP 404.
 *   exchange4media          Cloudflare bot challenge (cf-mitigated: challenge,
 *                           "Just a moment"). Solving it would be anti-bot
 *                           evasion, which this project does not do.
 */

export function enabledSources(): SourceDefinition[] {
  return SOURCES.filter((s) => s.enabled);
}

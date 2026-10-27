/**
 * The niche catalogue, the one place that decides what "a niche" is.
 *
 * Each niche is a set of communities split by geography. India and Global are
 * read separately so every conversation can say where it is happening, which
 * is what lets the interface filter by region and show an India/Global split
 * on each topic instead of guessing.
 *
 * Subreddits were checked against live activity (scripts/check-niches.ts).
 * Dead or private communities read as zero volume, so a stale entry here does
 * not break anything, it just contributes nothing. Re-run the check after
 * editing.
 */

import discovered from "./communities.json";

export type RegionCode = "IN" | "GLOBAL";

export interface Niche {
  id: string;
  label: string;
  /** One line for the niche card. */
  blurb: string;
  /** Every community read for the niche: the hand-picked ones first, then discovered ones, busiest first. */
  subreddits: Record<RegionCode, string[]>;
  /** The busiest ~16, read in depth; the rest get one lighter read each scan. */
  core: Record<RegionCode, string[]>;
  /** YouTube mostPopular videoCategoryId, when the niche maps to one. Travel (19) and Education (27) have no trending chart, YouTube answers 404. */
  youtubeCategory?: string;
  /** Read Hacker News into this niche. */
  hackerNews?: boolean;
  /** Terms that route a cross-niche signal (Google Trends, Wikipedia) here. */
  keywords: string[];
}

const CURATED: Omit<Niche, "core">[] = [
  {
    id: "tech-ai",
    label: "Tech & AI",
    blurb: "AI tools, gadgets, software and the people building them",
    subreddits: {
      IN: ["developersIndia", "IndiaTech", "indianstartups"],
      GLOBAL: ["technology", "ArtificialInteligence", "ChatGPT", "OpenAI", "LocalLLaMA", "singularity", "gadgets"],
    },
    youtubeCategory: "28",
    hackerNews: true,
    keywords: ["ai", "gpt", "openai", "gemini", "iphone", "android", "apple", "google", "samsung", "chip", "nvidia", "software", "app", "robot", "llm"],
  },
  {
    id: "money",
    label: "Money & Investing",
    blurb: "Stocks, personal finance, crypto and the cost of living",
    subreddits: {
      IN: ["IndiaInvestments", "IndianStreetBets", "personalfinanceindia", "FIREIndia"],
      GLOBAL: ["personalfinance", "stocks", "wallstreetbets", "investing", "CryptoCurrency"],
    },
    keywords: ["sensex", "nifty", "stock", "share", "ipo", "crypto", "bitcoin", "rupee", "inflation", "tax", "loan", "mutual fund", "gold", "rbi", "fed"],
  },
  {
    id: "startups",
    label: "Startups & Business",
    blurb: "Founders, side hustles, D2C brands and how companies are run",
    subreddits: {
      IN: ["StartUpIndia", "IndianEntrepreneur", "IndiaBusiness"],
      GLOBAL: ["startups", "Entrepreneur", "smallbusiness", "SaaS", "sidehustle"],
    },
    keywords: ["startup", "founder", "funding", "unicorn", "layoff", "d2c", "brand", "ceo", "acquisition"],
  },
  {
    id: "careers",
    label: "Careers & Work",
    blurb: "Jobs, salaries, workplace culture and hiring",
    subreddits: {
      IN: ["IndianWorkplace", "indiajobs", "MBA"],
      GLOBAL: ["careerguidance", "jobs", "antiwork", "recruitinghell", "cscareerquestions"],
    },
    keywords: ["job", "salary", "hiring", "layoff", "interview", "resume", "office", "work from home", "appraisal", "career"],
  },
  {
    id: "fitness",
    label: "Health & Fitness",
    blurb: "Training, diet, weight loss and wellbeing",
    subreddits: {
      IN: ["Fitness_India", "IndianFitness"],
      GLOBAL: ["Fitness", "loseit", "nutrition", "Biohackers", "running", "GYM"],
    },
    keywords: ["gym", "workout", "diet", "protein", "weight loss", "ozempic", "fitness", "yoga", "health", "sleep", "creatine"],
  },
  {
    id: "beauty",
    label: "Beauty & Skincare",
    blurb: "Skincare routines, makeup, haircare and product launches",
    subreddits: {
      IN: ["IndianSkincareAddicts", "IndianMakeupAddicts", "IndianHaircare"],
      GLOBAL: ["SkincareAddiction", "MakeupAddiction", "beauty", "HaircareScience"],
    },
    youtubeCategory: "26",
    keywords: ["skincare", "makeup", "serum", "sunscreen", "hair", "beauty", "lipstick", "fragrance", "perfume"],
  },
  {
    id: "fashion",
    label: "Fashion & Style",
    blurb: "What people are wearing, buying and arguing about",
    subreddits: {
      IN: ["IndianFashionAddicts", "IndianFashion"],
      GLOBAL: ["malefashionadvice", "femalefashionadvice", "streetwear", "Sneakers"],
    },
    keywords: ["fashion", "outfit", "sneaker", "streetwear", "saree", "kurta", "style", "zara", "nike"],
  },
  {
    id: "food",
    label: "Food & Cooking",
    blurb: "Recipes, restaurants, food trends and delivery apps",
    subreddits: {
      IN: ["IndianFood", "indiancooking"],
      GLOBAL: ["Cooking", "food", "EatCheapAndHealthy", "recipes"],
    },
    keywords: ["recipe", "food", "restaurant", "zomato", "swiggy", "cooking", "chef", "coffee", "chai"],
  },
  {
    id: "entertainment",
    label: "Movies, TV & Celebs",
    blurb: "Releases, box office, OTT and celebrity discourse",
    subreddits: {
      IN: ["bollywood", "BollyBlindsNGossip", "IndianCinema", "kollywood", "tollywood", "MalayalamMovies"],
      GLOBAL: ["movies", "television", "popculturechat", "Fauxmoi", "netflix"],
    },
    youtubeCategory: "24",
    keywords: ["movie", "film", "trailer", "box office", "netflix", "prime video", "series", "season", "actor", "actress", "bollywood", "celebrity", "ott"],
  },
  {
    id: "music",
    label: "Music",
    blurb: "Releases, artists, tours and what's on repeat",
    subreddits: {
      IN: ["IndianHipHopHeads", "BollywoodMusic"],
      GLOBAL: ["Music", "popheads", "hiphopheads", "kpop"],
    },
    youtubeCategory: "10",
    keywords: ["song", "album", "concert", "tour", "rapper", "singer", "spotify", "music", "grammy"],
  },
  {
    id: "gaming",
    label: "Gaming",
    blurb: "Launches, esports, consoles and mobile gaming",
    subreddits: {
      IN: ["IndianGaming", "BGMI"],
      GLOBAL: ["gaming", "Games", "pcgaming", "PS5", "NintendoSwitch"],
    },
    youtubeCategory: "20",
    keywords: ["game", "gaming", "esports", "playstation", "xbox", "nintendo", "steam", "gta", "bgmi"],
  },
  {
    id: "sports",
    label: "Sports",
    blurb: "Cricket, football, F1 and every argument about them",
    subreddits: {
      IN: ["Cricket", "IndianFootball", "IndiaCricket"],
      GLOBAL: ["sports", "soccer", "nba", "formula1", "nfl"],
    },
    youtubeCategory: "17",
    keywords: ["cricket", "ipl", "match", "football", "world cup", "f1", "nba", "kohli", "olympics", "league", "vs"],
  },
  {
    id: "life",
    label: "Relationships & Life",
    blurb: "Dating, family, marriage and everyday life questions",
    subreddits: {
      IN: ["AskIndia", "TwoXIndia", "IndiaSocial", "IndianTeenagers"],
      GLOBAL: ["relationship_advice", "AmItheAsshole", "TwoXChromosomes", "AskMen", "AskWomen"],
    },
    youtubeCategory: "22",
    keywords: ["dating", "marriage", "wedding", "relationship", "parents", "breakup", "family"],
  },
  {
    id: "news",
    label: "News & Society",
    blurb: "Politics, policy and the stories everyone has an opinion on",
    subreddits: {
      IN: ["india", "indiadiscussion", "IndiaSpeaks", "indianews"],
      GLOBAL: ["worldnews", "news", "OutOfTheLoop", "nottheonion"],
    },
    youtubeCategory: "25",
    keywords: ["election", "government", "minister", "court", "policy", "war", "protest", "president", "modi", "trump", "parliament"],
  },
  {
    id: "internet",
    label: "Memes & Internet Culture",
    blurb: "Viral moments, memes and creator drama",
    subreddits: {
      IN: ["IndianMeyMeys", "IndianDankMemes", "SaimanSays"],
      GLOBAL: ["memes", "TikTokCringe", "InstagramReality", "youtubedrama"],
    },
    youtubeCategory: "23",
    keywords: ["meme", "viral", "trend", "influencer", "youtuber", "drama", "reel", "roast"],
  },
  {
    id: "creators",
    label: "Creators & Social Media",
    blurb: "Growing an audience, platform changes and creator business",
    subreddits: {
      IN: ["YoutubeIndia"],
      GLOBAL: ["NewTubers", "youtubers", "socialmedia", "InstagramMarketing", "PartneredYoutube", "Instagram", "ContentCreators"],
    },
    keywords: ["instagram", "youtube", "tiktok", "algorithm", "creator", "followers", "reels", "shorts", "monetization", "linkedin"],
  },
  {
    id: "travel",
    label: "Travel",
    blurb: "Destinations, visas, flights and travel hacks",
    subreddits: {
      IN: ["IndiaTravel", "solotravelindia", "incredibleindia"],
      GLOBAL: ["travel", "solotravel", "digitalnomad", "awardtravel"],
    },
    keywords: ["travel", "flight", "visa", "trip", "hotel", "airline", "indigo", "airport", "tourism"],
  },
  {
    id: "education",
    label: "Education & Exams",
    blurb: "Exams, colleges, study abroad and learning",
    subreddits: {
      IN: ["JEENEETards", "Indian_Academia", "UPSC", "CATpreparation", "Indians_StudyAbroad"],
      GLOBAL: ["college", "GradSchool", "languagelearning", "studytips"],
    },
    keywords: ["exam", "jee", "neet", "upsc", "college", "university", "student", "admission", "result", "cbse"],
  },
  {
    id: "auto",
    label: "Cars & EVs",
    blurb: "Launches, EVs, bikes and buying decisions",
    subreddits: {
      IN: ["CarsIndia", "indianbikes"],
      GLOBAL: ["cars", "electricvehicles", "teslamotors"],
    },
    youtubeCategory: "2",
    keywords: ["car", "ev", "tesla", "bike", "suv", "tata", "mahindra", "maruti", "electric vehicle", "launch"],
  },
  {
    id: "cities",
    label: "City Life",
    blurb: "Rent, traffic, safety and what's happening in the big cities",
    subreddits: {
      IN: ["bangalore", "mumbai", "delhi", "hyderabad", "pune", "chennai", "kolkata"],
      GLOBAL: ["nyc", "london", "sanfrancisco", "toronto"],
    },
    keywords: ["traffic", "metro", "rent", "flat", "pg", "rain", "pollution", "aqi", "bengaluru", "bangalore", "mumbai", "delhi", "city"],
  },
];

/**
 * Each niche's hand-picked communities plus those found by
 * scripts/discover-communities.ts (lib/communities.json): checked to exist,
 * be safe for work and post at least daily, ordered by posts per week.
 */
const FOUND = (discovered as { niches?: Record<string, Partial<Record<RegionCode, (string | { name: string })[]>>> }).niches ?? {};
const MAX_COMMUNITIES = 100;
const CORE = { IN: 6, GLOBAL: 10 } as const;

function withCommunities(n: Omit<Niche, "core">): Niche {
  const seen = new Set<string>();
  const merge = (r: RegionCode) => [...n.subreddits[r], ...(FOUND[n.id]?.[r] ?? []).map((x) => (typeof x === "string" ? x : x.name))]
    .filter((s) => !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  const IN = merge("IN");
  const GLOBAL = merge("GLOBAL").slice(0, Math.max(0, MAX_COMMUNITIES - IN.length));
  return {
    ...n,
    subreddits: { IN, GLOBAL },
    core: {
      IN: IN.slice(0, Math.max(CORE.IN, n.subreddits.IN.length)),
      GLOBAL: GLOBAL.slice(0, Math.max(CORE.GLOBAL, n.subreddits.GLOBAL.length)),
    },
  };
}

export const NICHES: Niche[] = CURATED.map(withCommunities);

/** The hand-picked communities alone, before discovery, what discovery starts from. */
export const curatedSubreddits = (id: string) => CURATED.find((n) => n.id === id)?.subreddits ?? { IN: [], GLOBAL: [] };

export const NICHE_BY_ID = new Map(NICHES.map((n) => [n.id, n]));

export function nicheLabel(id: string): string {
  return NICHE_BY_ID.get(id)?.label ?? id;
}

/**
 * Communities that are about India even when they are not in the list above , 
 * used to attribute region to search results from anywhere on Reddit.
 */
const INDIAN_SUBS = new Set(
  NICHES.flatMap((n) => n.subreddits.IN).map((s) => s.toLowerCase()),
);
const INDIA_NAME = /(india|indian|desi|bharat|mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|kerala|tamil|kannada|telugu|marathi|bollywood|kollywood|tollywood|mollywood|jee|neet|upsc|cricket)/i;

export function isIndianCommunity(sub: string): boolean {
  return INDIAN_SUBS.has(sub.toLowerCase()) || INDIA_NAME.test(sub);
}

/** Best-guess niche for a free-text phrase. Used to route cross-niche signals. */
export function guessNiche(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { id: string; hits: number } | null = null;
  for (const n of NICHES) {
    const hits = n.keywords.filter((k) => t.includes(` ${k} `) || t.includes(` ${k}s `) || t.includes(` ${k},`)).length;
    if (hits && (!best || hits > best.hits)) best = { id: n.id, hits };
  }
  return best?.id ?? null;
}

import { NICHES } from "./niches";
import type { RegionFilter } from "./types";
import type { RankBy } from "./view";

/**
 * What a user told us about themselves after signing up, and what each
 * answer changes. Every question can be skipped; a skipped answer leaves the
 * feed as everyone else sees it.
 *
 *   niches     Pulse lists these first and "Hottest" opens on them
 *   region     the India / Global filter Pulse and Explore open on
 *   rankBy     whether lists sort by heat or virality
 *   platforms  the assistant pitches formats for these
 *   role       the assistant pitches angles for this kind of team
 */
export interface FeedPrefs {
  niches: string[];
  region: RegionFilter | null;
  rankBy: RankBy | null;
  platforms: string[];
  role: string | null;
}

export const EMPTY_PREFS: FeedPrefs = { niches: [], region: null, rankBy: null, platforms: [], role: null };

export type QuestionId = keyof FeedPrefs;

export interface Question {
  id: QuestionId;
  title: string;
  hint: string;
  multi: boolean;
  options: { value: string; label: string; sub?: string }[];
}

export const QUESTIONS: Question[] = [
  {
    id: "niches", multi: true,
    title: "Which niches do you make content in?",
    hint: "Pick as many as you like. They come first on your feed.",
    options: NICHES.map((n) => ({ value: n.id, label: n.label })),
  },
  {
    id: "region", multi: false,
    title: "Where is your audience?",
    hint: "Your feed opens on this. You can switch any time.",
    options: [
      { value: "IN", label: "India", sub: "Indian communities and searches" },
      { value: "GLOBAL", label: "Global", sub: "Everywhere outside India" },
      { value: "ALL", label: "Both", sub: "Everything, with an India / Global split" },
    ],
  },
  {
    id: "platforms", multi: true,
    title: "Where do you post?",
    hint: "The assistant suggests formats for these.",
    options: [
      { value: "youtube", label: "YouTube (long-form)" },
      { value: "shorts", label: "Shorts / Reels" },
      { value: "instagram", label: "Instagram posts and carousels" },
      { value: "x", label: "X / Threads" },
      { value: "linkedin", label: "LinkedIn" },
      { value: "newsletter", label: "Blog or newsletter" },
      { value: "podcast", label: "Podcast" },
    ],
  },
  {
    id: "rankBy", multi: false,
    title: "What should rank a topic higher?",
    hint: "Sets how your lists are sorted.",
    options: [
      { value: "heat", label: "Heat", sub: "The biggest conversations: most threads, comments and views" },
      { value: "virality", label: "Virality", sub: "The fastest-spreading: reactions per hour since it started" },
    ],
  },
  {
    id: "role", multi: false,
    title: "Which best describes you?",
    hint: "The assistant tailors its angles to this.",
    options: [
      { value: "creator", label: "Solo creator" },
      { value: "brand", label: "Brand or company" },
      { value: "agency", label: "Agency or social media manager" },
      { value: "media", label: "Newsroom or publisher" },
      { value: "exploring", label: "Just exploring" },
    ],
  },
];

const VALID = new Map(QUESTIONS.map((q) => [q.id, new Set(q.options.map((o) => o.value))]));

/** Keep only answers that are still valid options. */
export function cleanPrefs(input: Partial<Record<QuestionId, unknown>>): FeedPrefs {
  const many = (id: QuestionId) => Array.isArray(input[id])
    ? [...new Set((input[id] as unknown[]).filter((v): v is string => typeof v === "string" && VALID.get(id)!.has(v)))]
    : [];
  const one = (id: QuestionId) => typeof input[id] === "string" && VALID.get(id)!.has(input[id] as string) ? input[id] as string : null;
  return {
    niches: many("niches"),
    region: one("region") as RegionFilter | null,
    rankBy: one("rankBy") as RankBy | null,
    platforms: many("platforms"),
    role: one("role"),
  };
}

/** The answers, written out for the assistant's system prompt. */
export function describePrefs(p: FeedPrefs): string | undefined {
  const label = (id: QuestionId, v: string) => QUESTIONS.find((q) => q.id === id)?.options.find((o) => o.value === v)?.label ?? v;
  const lines = [
    p.role && `They are: ${label("role", p.role)}.`,
    p.niches.length && `Their niches: ${p.niches.map((n) => label("niches", n)).join(", ")}.`,
    p.region && p.region !== "ALL" && `Their audience is mainly ${p.region === "IN" ? "in India" : "outside India"}.`,
    p.platforms.length && `They post on: ${p.platforms.map((v) => label("platforms", v)).join(", ")}. Suggest formats for these first.`,
  ].filter(Boolean);
  return lines.length ? lines.join(" ") : undefined;
}

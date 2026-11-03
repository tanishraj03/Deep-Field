import type { TopicVerdict } from "./types";

/** Feedback types and labels shared with the browser. The store side is lib/feedback.ts. */

export type Outcome = "below" | "usual" | "above" | "viral";
export type Call = TopicVerdict["call"];

/** A topic as it was when someone voted on it or made it: topics are replaced every scan. */
export interface TopicRef {
  key: string;
  niche: string;
  title: string;
  call: Call;
  score: number;
  heat: number;
  virality: number;
}

export interface Vote { topic: TopicRef; vote: 1 | -1; at: string }

export interface Made {
  id: string;
  topic: TopicRef;
  madeAt: string;
  /** "Short", "Long-form video", "Carousel"… what they made. */
  format: string | null;
  url: string | null;
  outcome: { result: Outcome; views: number | null; reportedAt: string } | null;
}

export interface UserFeedback { votes: Record<string, Vote>; made: Made[] }

export const OUTCOMES: { value: Outcome; label: string; sub: string }[] = [
  { value: "below", label: "Below my usual", sub: "Fewer views or likes than normal" },
  { value: "usual", label: "About my usual", sub: "Normal for me" },
  { value: "above", label: "Above my usual", sub: "Clearly better than normal" },
  { value: "viral", label: "Went viral", sub: "Several times my usual" },
];

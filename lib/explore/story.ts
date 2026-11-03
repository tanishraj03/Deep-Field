import type { ExploreResult, Post, StoryCheck } from "@/lib/types";
import { terms } from "@/lib/utils";

/**
 * Is there a story this week, or only the usual talk about a familiar thing?
 * Search "uranus" and thousands of posts come back, because people always
 * mention planets: jokes, homework, astrophotos. Volume says nothing about
 * whether something new is happening. Three tests, each from data already
 * fetched, so this costs no extra requests:
 *
 *   novelty    this week's Wikipedia views against the article's usual day,
 *              from the 60 days before the last 30
 *   relevance  how many posts name the topic in their title, rather than
 *              matching because it appears somewhere in the body
 *   focus      whether those posts share a subject beyond the topic itself
 *              ("uranus probe", "uranus moons"): a story has one, chatter
 *              is spread across unrelated ones
 */

export function titleMatches(title: string, query: string): boolean {
  const t = title.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).every((w) => t.includes(w));
}

/** A word in the query, or its plural or singular. */
function inQuery(word: string, query: Set<string>) {
  return query.has(word) || query.has(word.replace(/e?s$/, "")) || query.has(`${word}s`);
}

/** The phrase most of these posts share besides the query, if enough do. */
function focusOf(query: string, posts: Post[]): StoryCheck["focus"] {
  if (posts.length < 8) return null;
  const q = new Set(terms(query));
  const df = new Map<string, { posts: number; communities: Set<string> }>();
  for (const p of posts) {
    const words = terms(p.title).filter((w) => !inQuery(w, q));
    const seen = new Set([...words, ...words.slice(1).map((w, i) => `${words[i]} ${w}`)]);
    for (const k of seen) {
      const e = df.get(k) ?? { posts: 0, communities: new Set<string>() };
      e.posts++;
      e.communities.add(p.community);
      df.set(k, e);
    }
  }
  // At least three posts, in at least two places: one subreddit's recurring
  // title format is not a story.
  const ranked = [...df.entries()]
    .filter(([, e]) => e.posts >= 3 && e.communities.size >= 2)
    .sort((a, b) => b[1].posts - a[1].posts);
  // Single words need some length: "pro" or "max" name a variant, not a subject.
  const word = ranked.find(([k]) => !k.includes(" ") && k.length >= 4);
  const pair = ranked.find(([k]) => k.includes(" "));
  // A two-word phrase reads better ("nasa probe") when it covers most of what the top word does.
  const best = pair && (!word || pair[1].posts >= 0.6 * word[1].posts) ? pair : word;
  return best ? { phrase: best[0], share: Math.round((best[1].posts / posts.length) * 100) / 100 } : null;
}

export function storyCheck(r: Pick<ExploreResult, "query" | "posts" | "attention">, momentum: number | null): StoryCheck {
  const about = r.posts.filter((p) => titleMatches(p.title, r.query));
  const relevance = r.posts.length ? Math.round((about.length / r.posts.length) * 100) / 100 : 0;
  const focus = focusOf(r.query, about);

  const week = r.attention?.daily.slice(-7).map((d) => d.views) ?? [];
  const usual = r.attention?.usual;
  const novelty = usual && week.length >= 5 ? Math.round((week.reduce((a, v) => a + v, 0) / week.length / usual) * 100) / 100 : null;

  const fresh = novelty !== null ? novelty >= 1.4 : momentum !== null && momentum >= 1.3;
  const focused = !!focus && focus.share >= 0.25;
  // Only called evergreen on evidence: a known usual level, or plenty of
  // posts that still share no subject. A handful of posts is just thin.
  const evergreen = !fresh && !focused && (novelty !== null || r.posts.length >= 30);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const times = (n: number) => `${Math.round(n * 10) / 10}×`;
  const label =
    novelty !== null && novelty >= 2 ? `Breaking out: ${times(novelty)} its usual interest`
    : fresh ? (novelty !== null ? `Above its usual: ${times(novelty)} normal interest` : "More conversation than a few days ago")
    : evergreen ? "Evergreen: always talked about, no new story this week"
    : focused ? `One story leads: “${focus!.phrase}” in ${pct(focus!.share)} of posts`
    : "About its usual level of interest";

  return { novelty, relevance, focus, evergreen, label };
}

import type { ExploreResult, Post } from "@/lib/types";
import { compact, relativeTime } from "@/lib/utils";

/** One post as a single dense line the model can cite by index. */
export function postLine(p: Post, i: number): string {
  const nums = [
    p.comments !== undefined ? `${compact(p.comments)} comments` : null,
    p.score !== undefined ? `${compact(p.score)} ${p.source === "youtube" ? "likes" : "upvotes"}` : null,
    p.views !== undefined ? `${compact(p.views)} views` : null,
    p.hotRank ? `hot #${p.hotRank}` : null,
    !p.measured && p.source === "reddit" ? "new, not yet counted" : null,
  ].filter(Boolean).join(" · ");
  const snippet = p.snippet ? ` — ${p.snippet.slice(0, 140)}` : "";
  return `[${i}] ${p.community} (${p.region === "IN" ? "India" : "Global"}) · ${relativeTime(p.createdAt)}${nums ? ` · ${nums}` : ""} | ${p.title}${snippet}`;
}

export const CLUSTER_SYSTEM = `You are the research analyst behind a content team. You read raw social posts and name the distinct conversations the internet is having, so the team knows what to make content about.

Return JSON only, shaped exactly:
{"topics":[{
  "title": "specific, max 8 words — names the actual thing (a product, person, event, claim, habit), never a category",
  "summary": "2 sentences: what people are actually saying, the tension or debate",
  "whyNow": "1 sentence: why this is being discussed right now",
  "sentiment": "positive" | "negative" | "mixed" | "neutral",
  "questions": ["up to 3 questions people are asking, phrased the way they would ask them"],
  "angles": [{"format": "Reel" | "Short" | "Carousel" | "Long-form video" | "Thread" | "Meme" | "Newsletter", "hook": "a specific, scroll-stopping hook or title for this conversation"}],
  "posts": [indices of the posts that belong to this conversation]
}]}

Rules:
- 6 to 12 topics, strongest first. A topic needs at least 2 posts, unless a single post drew far more discussion than the rest.
- Every index must come from the list. A post belongs to at most one topic.
- Skip weekly/megathreads, moderator notices, self-promotion and individual "help me" posts that are not part of a wider conversation — unless many people are asking the same thing, which IS a conversation ("Everyone is asking whether X…").
- Prefer conversations with real engagement or that appear across several communities. Include India and Global conversations when both are present.
- Write 2-3 angles per topic. Hooks must be specific to this conversation, not generic advice.
- Never invent numbers, names or facts that are not in the posts.`;

export function clusterUser(nicheLabel: string, posts: Post[]): string {
  return `Niche: ${nicheLabel}
Posts (${posts.length}):
${posts.map(postLine).join("\n")}`;
}

export const INSIGHT_SYSTEM = `You are a content research analyst. You are given everything the internet said about one topic in the past week — counts by source and the actual posts — and you explain the conversation to a content creator deciding whether and how to make content about it.

Return JSON only:
{
  "summary": "3-4 sentences: what the conversation is, its size relative to the data, and who is driving it",
  "threads": [{"title": "a sub-conversation inside the topic", "detail": "1-2 sentences, citing communities or posts by name"}],
  "sentiment": {"label": "positive" | "negative" | "mixed" | "neutral", "detail": "1 sentence on how people feel and why"},
  "questions": ["up to 5 questions people are asking"],
  "angles": [{"format": "Reel" | "Short" | "Carousel" | "Long-form video" | "Thread" | "Meme" | "Newsletter", "hook": "a specific hook"}],
  "verdict": "1-2 sentences: is this worth making content on now, for which audience (India/global), and what the gap is"
}

3-5 threads, 4-6 angles. Ground every claim in the data. Quote counts only as given. If the data is thin, say so plainly instead of padding.`;

export function insightUser(r: ExploreResult): string {
  const sources = r.sources.map((s) =>
    `- ${s.source}: ${s.ok ? `${s.total ?? "?"}${s.capped ? "+" : ""} in ${s.window}` : `unavailable (${s.note})`}`).join("\n");
  const communities = r.communities.slice(0, 12).map((c) => `${c.name} (${c.posts})`).join(", ");
  return `Topic: "${r.query}"  ·  Region filter: ${r.region === "ALL" ? "everywhere" : r.region === "IN" ? "India" : "Global"}
Conversations found: ${r.totals.conversations} · comments ${r.totals.comments} · upvotes ${r.totals.score} · video views ${r.totals.views}
India vs global posts: ${r.regionSplit.IN} / ${r.regionSplit.GLOBAL}
By source:
${sources}
Top communities: ${communities || "none"}
${r.attention ? `Wikipedia "${r.attention.article}" views, last 7 days: ${r.attention.daily.slice(-7).map((d) => d.views).join(", ")}` : ""}

Posts:
${r.posts.slice(0, 70).map(postLine).join("\n")}`;
}

export function assistantSystem(today: string, context?: string): string {
  return `You are Deep Field's research assistant. Deep Field tracks the conversations happening across Reddit, Hacker News, YouTube, news, Wikipedia, Google Trends, Bluesky and Mastodon, in India and globally, organised by niche. You help a content team decide what to make content about and go deeper on topics.

Today is ${today}.

How you work:
- Use your tools to get real data before answering anything about what people are saying, how big a conversation is, or what is trending. Do not answer those from memory.
- get_trending gives the latest scanned conversations for a niche and region. research_topic searches any topic across sources and returns real counts. read_thread reads a Reddit thread's top replies.
- Cite numbers exactly as the tools give them, and name the communities and sources. Link to threads with markdown links when useful.
- Be specific and opinionated about content: concrete hooks, formats (Reels, Shorts, carousels, long-form, threads), audience (India vs global) and the gap nobody is covering yet.
- Keep answers tight. Use short headings and bullets. No filler.
- If a tool fails or the data is thin, say so plainly.${context ? `\n\nThe user opened this chat from the following research. Use it as context:\n${context}` : ""}`;
}

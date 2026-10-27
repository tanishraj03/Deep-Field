import { queryDiscussion, topicDiscussion } from "@/lib/discussion";
import { explore } from "@/lib/explore";
import { NICHES, nicheLabel } from "@/lib/niches";
import { loadPulse } from "@/lib/pulse/scan";
import { readThread } from "@/lib/sources/reddit";
import type { NicheScan, Post, RegionFilter, Topic } from "@/lib/types";
import { compact, relativeTime, truncate } from "@/lib/utils";
import { commentIndex } from "@/lib/view";
import type { ToolDef } from "./client";

/** The assistant's tools. Each one reads the same data the interface shows. */

const REGION = { type: "string", enum: ["ALL", "IN", "GLOBAL"], description: "IN = India, GLOBAL = rest of world, ALL = both" };

export const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_trending",
      description: "The conversations DeepField's latest scan found, ranked by heat, with real post/comment/view counts, virality (reactions per hour), a make/test/skip verdict with reasons, summaries and top threads. Use for 'what is trending', 'what should I make', 'what is India talking about', or to compare niches.",
      parameters: {
        type: "object",
        properties: {
          niche: { type: "string", enum: NICHES.map((n) => n.id), description: `Optional. One of: ${NICHES.map((n) => `${n.id} (${n.label})`).join(", ")}. Omit for all niches.` },
          region: REGION,
          limit: { type: "number", description: "How many topics, default 8, max 20" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research_topic",
      description: "Search the past week of conversation about any topic across Reddit, YouTube, Bluesky, Hacker News, Lemmy, news (GDELT and Google News), Wikipedia and Instagram (when connected). Returns how many conversations there are, per source and per day, a computed opportunity score with virality, momentum and saturation, the India/global split, the communities and the top threads. Takes 10-30 seconds.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The topic, 1-4 words works best (e.g. 'ozempic', 'iphone 18', 'zepto layoffs')" },
          region: REGION,
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "whats_being_said",
      description: "The most revealing comments, replies and Bluesky posts about a conversation: the ones that explain why it is spreading, the strongest pushback, first-hand experience and open questions, each with a note on what it reveals, plus the main themes. Pass `topic` for a scanned topic (its niche:id ref) or `query` for any subject. Takes 10-30 seconds the first time.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "A scanned topic's ref, niche:id (given in context when the chat was opened from a topic)" },
          query: { type: "string", description: "Any subject, 1-4 words, when there is no topic ref" },
          region: REGION,
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_thread",
      description: "Read a Reddit thread: the post and its top replies. Use to find out what people actually think, their objections and their language.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "A reddit.com thread URL" } },
        required: ["url"],
      },
    },
  },
];

function postBrief(p: Post) {
  const nums = [
    p.comments !== undefined ? `${compact(p.comments)} comments` : null,
    p.score !== undefined ? `${compact(p.score)} ${p.source === "youtube" ? "likes" : "upvotes"}` : null,
    p.views !== undefined ? `${compact(p.views)} views` : null,
  ].filter(Boolean).join(", ");
  return `${p.title} — ${p.community}, ${relativeTime(p.createdAt)}${nums ? `, ${nums}` : ""} — ${p.url}`;
}

function inRegion(t: Topic, region: RegionFilter) {
  return region === "ALL" || (region === "IN" ? t.metrics.postsIN > 0 : t.metrics.postsGLOBAL > 0);
}

function topicBrief(t: Topic, scan: NicheScan, region: RegionFilter) {
  const posts = t.postIds.map((id) => scan.posts.find((p) => p.id === id)).filter((p): p is Post => !!p)
    .filter((p) => region === "ALL" || p.region === region);
  return {
    niche: nicheLabel(t.niche),
    title: t.title,
    heat: t.heat,
    virality: `${t.virality}/100 (~${compact(t.metrics.perHour)} reactions an hour)`,
    verdict: t.verdict ? `${t.verdict.call} (${t.verdict.score}/100): ${t.verdict.reasons.join("; ")}` : undefined,
    trend: t.isNew ? "new" : t.heatDelta === null ? "—" : t.heatDelta > 0 ? `rising (+${t.heatDelta})` : t.heatDelta < 0 ? `cooling (${t.heatDelta})` : "steady",
    summary: t.summary,
    whyNow: t.whyNow,
    sentiment: t.sentiment,
    counts: `${t.metrics.posts} posts (${t.metrics.postsIN} India / ${t.metrics.postsGLOBAL} global), ${compact(t.metrics.comments)} comments, ${compact(t.metrics.score)} upvotes${t.metrics.views ? `, ${compact(t.metrics.views)} views` : ""}, ${t.metrics.communities} communities`,
    questions: t.questions,
    angles: t.angles.map((a) => `${a.format}: ${a.hook}`),
    topThreads: posts.slice(0, 3).map(postBrief),
  };
}

async function getTrending(args: { niche?: string; region?: RegionFilter; limit?: number }) {
  const region = args.region ?? "ALL";
  const limit = Math.min(20, Math.max(1, args.limit ?? 8));
  const pulse = await loadPulse();
  const scans = args.niche ? pulse.scans.filter((s) => s.niche === args.niche) : pulse.scans;
  if (!scans.length) {
    return { note: args.niche ? `No scan yet for ${nicheLabel(args.niche)}. Suggest running a scan from Pulse, or use research_topic.` : "No scans yet. Suggest running a scan from Pulse." };
  }
  const topics = scans
    .flatMap((s) => s.topics.filter((t) => inRegion(t, region)).map((t) => ({ t, s })))
    .sort((a, b) => b.t.heat - a.t.heat)
    .slice(0, limit);
  const signals = (pulse.signals?.signals ?? [])
    .filter((x) => region === "ALL" || x.region === region)
    .filter((x) => !args.niche || x.niche === args.niche)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((x) => `${x.title} — ${x.measure} (${x.source}${x.context ? `; ${x.context}` : ""})`);
  return {
    scannedAt: scans.map((s) => `${nicheLabel(s.niche)}: ${relativeTime(s.scannedAt)}`).join("; "),
    region,
    topics: topics.map(({ t, s }) => topicBrief(t, s, region)),
    spikingSearchesAndPages: signals,
  };
}

async function researchTopic(args: { query: string; region?: RegionFilter }) {
  const r = await explore(args.query, args.region ?? "ALL");
  return {
    query: r.query,
    region: r.region,
    totalConversations: r.totals.conversations,
    opportunity: r.opportunity ? `${r.opportunity.call} (${r.opportunity.score}/100), virality ${r.opportunity.virality}/100: ${r.opportunity.signals.join("; ")}` : undefined,
    comments: r.totals.comments,
    upvotes: r.totals.score,
    videoViews: r.totals.views,
    indiaVsGlobalPosts: r.regionSplit,
    bySource: r.sources.map((s) => `${s.source}: ${s.ok ? `${s.total ?? "?"}${s.capped ? "+" : ""} in ${s.window}` : "unavailable"}${s.note ? ` (${s.note})` : ""}`),
    perDayLast7: r.daily.slice(-7).map((d) => `${d.date}: reddit ${d.reddit}, HN ${d.hackernews}, news ${d.news}, youtube ${d.youtube}`),
    wikipediaViewsLast7: r.attention ? `${r.attention.article}: ${r.attention.daily.slice(-7).map((d) => d.views).join(", ")}` : null,
    topCommunities: r.communities.slice(0, 10).map((c) => `${c.name} (${c.posts})`),
    topThreads: r.posts.slice(0, 25).map(postBrief),
  };
}

async function readThreadTool(args: { url: string }) {
  const t = await readThread(args.url);
  return {
    title: t.title, community: t.community, url: t.url,
    counts: [t.comments !== undefined ? `${t.comments} comments` : null, t.score !== undefined ? `${t.score} upvotes` : null].filter(Boolean).join(", ") || "counts not yet available",
    post: t.body,
    topReplies: t.replies.slice(0, 30).map((r) => r.text),
  };
}

async function whatsBeingSaid(args: { topic?: string; query?: string; region?: RegionFilter }) {
  const d = args.topic?.includes(":")
    ? await topicDiscussion(args.topic.split(":")[0], args.topic.split(":")[1])
    : await queryDiscussion(args.query ?? "", args.region ?? "ALL");
  const index = commentIndex(d);
  const threads = new Map(d.threads.map((t) => [t.postId, t]));
  const line = (id: string) => {
    const c = index.get(id);
    if (!c) return null;
    const t = threads.get(c.postId);
    const nums = [c.score !== undefined ? `${compact(c.score)} ${c.source === "reddit" ? "upvotes" : "likes"}` : null, c.replyCount ? `${c.replyCount} replies` : null].filter(Boolean).join(", ");
    return `${t?.community ?? c.source}${nums ? ` (${nums})` : ""}: “${truncate(c.text.replace(/\s+/g, " "), 320)}” — ${c.url}`;
  };
  return {
    takeaway: d.takeaway || d.note || "",
    threadsRead: d.threads.filter((t) => t.ok).map((t) => `${t.community}: ${t.title} (${t.comments.length} top comments)`),
    picks: d.picks.map((p) => ({ role: p.role, whyItMatters: p.why, comment: line(p.commentId) })).filter((p) => p.comment),
    themes: d.themes.map((t) => ({ theme: t.label, detail: t.detail, examples: t.commentIds.slice(0, 2).map(line).filter(Boolean) })),
  };
}

export interface ToolOutcome { content: string; summary: string; ok: boolean }

export async function runTool(name: string, rawArgs: string, maxChars: number): Promise<ToolOutcome> {
  let args: Record<string, unknown>;
  try { args = rawArgs ? JSON.parse(rawArgs) : {}; } catch { args = {}; }
  try {
    let result: unknown;
    let summary = "";
    if (name === "get_trending") {
      const r = await getTrending(args as Parameters<typeof getTrending>[0]);
      result = r;
      summary = r.topics ? `${r.topics.length} trending conversations${args.niche ? ` in ${nicheLabel(String(args.niche))}` : ""}` : r.note ?? "";
    } else if (name === "research_topic") {
      const r = await researchTopic(args as Parameters<typeof researchTopic>[0]);
      result = r;
      summary = `${r.totalConversations} conversations about “${r.query}”`;
    } else if (name === "whats_being_said") {
      const r = await whatsBeingSaid(args as Parameters<typeof whatsBeingSaid>[0]);
      result = r;
      summary = `${r.picks.length} revealing comments from ${r.threadsRead.length} threads`;
    } else if (name === "read_thread") {
      const r = await readThreadTool(args as Parameters<typeof readThreadTool>[0]);
      result = r;
      summary = `${r.topReplies.length} replies in ${r.community}`;
    } else {
      return { ok: false, content: `Unknown tool ${name}`, summary: "unknown tool" };
    }
    let content = JSON.stringify(result);
    if (content.length > maxChars) content = `${content.slice(0, maxChars)}…(truncated)`;
    return { ok: true, content, summary };
  } catch (e) {
    const msg = (e as Error).message;
    return { ok: false, content: `Tool failed: ${msg}`, summary: msg };
  }
}

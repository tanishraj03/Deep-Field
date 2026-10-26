import { explore } from "@/lib/explore";
import { NICHES, nicheLabel } from "@/lib/niches";
import { loadPulse } from "@/lib/pulse/scan";
import { readThread } from "@/lib/sources/reddit";
import type { NicheScan, Post, RegionFilter, Topic } from "@/lib/types";
import { compact, relativeTime } from "@/lib/utils";
import type { ToolDef } from "./client";

/** The assistant's tools. Each one reads the same data the interface shows. */

const REGION = { type: "string", enum: ["ALL", "IN", "GLOBAL"], description: "IN = India, GLOBAL = rest of world, ALL = both" };

export const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "get_trending",
      description: "The conversations Deep Field's latest scan found, ranked by heat, with real post/comment counts, summaries and top threads. Use for 'what is trending', 'what is India talking about', or to compare niches.",
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
      description: "Search the past week of conversation about any topic across Reddit, Hacker News, YouTube, news (GDELT) and Wikipedia. Returns how many conversations there are, per source and per day, the India/global split, the communities discussing it and the top threads. Takes 10-30 seconds.",
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

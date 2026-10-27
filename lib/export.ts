import { queryDiscussion, topicDiscussion } from "@/lib/discussion";
import { cachedExplore, cachedInsight, explore } from "@/lib/explore";
import { nicheLabel } from "@/lib/niches";
import { loadScan } from "@/lib/pulse/scan";
import type { Discussion, Post, RegionFilter } from "@/lib/types";
import { compact, relativeTime } from "@/lib/utils";
import { commentIndex, mentionsOf, postsFor } from "@/lib/view";

/**
 * Everything DeepField knows about a topic or search, as one Markdown
 * document another AI can read cold: the numbers, the verdict and why, every
 * thread with its link, and the comments that explain it.
 */

export type ExportContext =
  | { type: "topic"; niche: string; topicId: string }
  | { type: "explore"; query: string; region: RegionFilter };

const VERDICT = { make: "Make now", test: "Worth testing", skip: "Skip" } as const;
const where = (r: RegionFilter) => (r === "ALL" ? "everywhere" : r === "IN" ? "India" : "global");

function postLine(p: Post): string {
  const nums = [
    p.comments !== undefined ? `${compact(p.comments)} comments` : null,
    p.score !== undefined ? `${compact(p.score)} ${p.source === "youtube" || p.source === "bluesky" || p.source === "instagram" ? "likes" : "upvotes"}` : null,
    p.views !== undefined ? `${compact(p.views)} views` : null,
  ].filter(Boolean).join(", ");
  return `- [${p.title.replace(/[[\]]/g, "")}](${p.url}) — ${p.community} (${p.region === "IN" ? "India" : "Global"}), ${relativeTime(p.createdAt)}${nums ? `, ${nums}` : ""}`;
}

function discussionSection(d: Discussion | null): string {
  if (!d || !d.picks.length) return "";
  const index = commentIndex(d);
  const threads = new Map(d.threads.map((t) => [t.postId, t]));
  const quote = (id: string) => {
    const c = index.get(id);
    if (!c) return null;
    const nums = [c.score !== undefined ? `${compact(c.score)} ${c.source === "reddit" ? "upvotes" : "likes"}` : null, c.replyCount ? `${c.replyCount} replies` : null].filter(Boolean).join(", ");
    return `> ${c.text.replace(/\s+/g, " ").slice(0, 500)}\n> — ${threads.get(c.postId)?.community ?? c.source}${nums ? `, ${nums}` : ""} · [link](${c.url})`;
  };
  const picks = d.picks.map((p) => {
    const q = quote(p.commentId);
    return q ? `**${p.role}**${p.why ? ` — ${p.why}` : ""}\n${q}` : null;
  }).filter(Boolean);
  const themes = d.themes.map((t) => `- **${t.label}**: ${t.detail}`);
  return [
    "## What people are saying",
    d.takeaway ? `${d.takeaway}\n` : "",
    themes.length ? `### Themes\n${themes.join("\n")}\n` : "",
    `### The most revealing comments\n${picks.join("\n\n")}`,
  ].filter(Boolean).join("\n");
}

async function topicSection(niche: string, topicId: string): Promise<string> {
  const scan = await loadScan(niche);
  const t = scan?.topics.find((x) => x.id === topicId);
  if (!scan || !t) return "_This topic is no longer in the latest scan._";
  const m = t.metrics;
  const discussion = await topicDiscussion(niche, topicId).catch(() => null);
  return [
    `# ${t.title}`,
    `Niche: ${nicheLabel(niche)} · scanned ${relativeTime(scan.scannedAt)} by DeepField`,
    "",
    `**Verdict: ${VERDICT[t.verdict.call]} (${t.verdict.score}/100).** ${t.verdict.reasons.join(". ")}.`,
    "",
    `- Heat ${t.heat}/100 · Virality ${t.virality}/100 (~${compact(m.perHour)} reactions an hour)${t.heatDelta !== null ? ` · heat ${t.heatDelta >= 0 ? "+" : ""}${t.heatDelta} since last scan` : t.isNew ? " · new this scan" : ""}`,
    (() => { const x = mentionsOf(t, "ALL"); return `- ${x.total.toLocaleString("en-US")}${x.capped ? "+" : ""} mentions: ${x.threads.toLocaleString("en-US")} posts and comments in the threads${x.bluesky ? `, ${x.bluesky.toLocaleString("en-US")} Bluesky posts` : ""}${x.hackernews ? `, ${x.hackernews} Hacker News stories and comments` : ""} (last 7 days)`; })(),
    `- ${m.posts} threads across ${m.communities} communities (${m.postsIN} India / ${m.postsGLOBAL} global), ${m.last24h} in the last 24h`,
    `- ${compact(m.comments)} comments · ${compact(m.score)} upvotes/likes${m.views ? ` · ${compact(m.views)} video views` : ""}`,
    `- Sentiment: ${t.sentiment}`,
    "",
    "## Summary",
    t.summary,
    t.whyNow ? `\n**Why now:** ${t.whyNow}` : "",
    t.questions.length ? `\n## What people are asking\n${t.questions.map((q) => `- ${q}`).join("\n")}` : "",
    t.angles.length ? `\n## Content angles\n${t.angles.map((a) => `- **${a.format}:** ${a.hook}`).join("\n")}` : "",
    `\n## The threads\n${postsFor(t, scan, "ALL").map(postLine).join("\n")}`,
    discussion ? `\n${discussionSection(discussion)}` : "",
  ].join("\n");
}

async function exploreSection(query: string, region: RegionFilter): Promise<string> {
  const r = (await cachedExplore(query, region)) ?? (await explore(query, region));
  const [insight, discussion] = await Promise.all([cachedInsight(query, region), queryDiscussion(query, region).catch(() => null)]);
  const o = r.opportunity;
  const d = insight?.decision;
  return [
    `# “${r.query}” — this week, ${where(r.region)}`,
    `Searched ${relativeTime(r.fetchedAt)} by DeepField`,
    "",
    d ? `**Verdict: ${VERDICT[d.call]} (${d.score}/100).** ${insight!.verdict}` : o ? `**Opportunity: ${VERDICT[o.call]} (${o.score}/100).**` : "",
    d?.reasons.length ? `- For: ${d.reasons.join("; ")}` : "",
    d?.risks.length ? `- Against: ${d.risks.join("; ")}` : "",
    d?.gap ? `- Gap: ${d.gap}` : "",
    o ? `- Signals: ${o.signals.join("; ")}` : "",
    "",
    `- ${(r.totals.mentions ?? r.totals.conversations).toLocaleString("en-US")} mentions · ${r.totals.conversations.toLocaleString("en-US")} posts, videos and articles · ${compact(r.totals.comments)} comments · ${compact(r.totals.score)} upvotes/likes${r.totals.views ? ` · ${compact(r.totals.views)} video views` : ""}`,
    `- India vs global threads: ${r.regionSplit.IN} / ${r.regionSplit.GLOBAL}`,
    `- By source: ${r.sources.map((s) => `${s.source} ${s.ok ? `${s.total ?? "?"}${s.capped ? "+" : ""}` : "unavailable"}`).join(", ")}`,
    `- Top communities: ${r.communities.slice(0, 10).map((c) => `${c.name} (${c.posts})`).join(", ") || "none"}`,
    insight ? `\n## What's being said\n${insight.summary}\n${insight.threads.map((t) => `- **${t.title}**: ${t.detail}`).join("\n")}` : "",
    insight?.questions.length ? `\n## What people are asking\n${insight.questions.map((q) => `- ${q}`).join("\n")}` : "",
    insight?.angles.length ? `\n## Content angles\n${insight.angles.map((a) => `- **${a.format}:** ${a.hook}`).join("\n")}` : "",
    `\n## Top threads\n${r.posts.slice(0, 30).map(postLine).join("\n")}`,
    discussion ? `\n${discussionSection(discussion)}` : "",
  ].filter((l) => l !== "").join("\n");
}

export async function contextMarkdown(ctx: ExportContext): Promise<string> {
  return ctx.type === "topic" ? topicSection(ctx.niche, ctx.topicId) : exploreSection(ctx.query, ctx.region);
}

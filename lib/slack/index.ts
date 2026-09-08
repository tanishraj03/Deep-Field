import { config } from "@/lib/config";
import { fetchWithTimeout, truncate } from "@/lib/utils";
import type { DailyBrief, IntelligenceItem } from "@/lib/types";

const RULE = "━━━━━━━━━━━━━━━━━━";

function bullets(lines: string[], numbered = false): string {
  if (!lines.length) return "_Nothing new today._";
  return lines.map((l, i) => (numbered ? `${i + 1}. ${l}` : `• ${l}`)).join("\n");
}

/**
 * Slack Incoming Webhook. Free on every Slack plan, no automation platform,
 * no Zapier, no Make. One POST, once a morning.
 */
export function formatBrief(brief: DailyBrief, items: IntelligenceItem[]): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(new Date(brief.generatedAt)).toUpperCase();

  const degraded = brief.theSignal.generatedBy === "rules"
    ? "\n_Generated without AI — free quota unavailable. Signals below are raw._\n"
    : "";

  return [
    `🌅 *DEEP FIELD — GOOD MORNING*`,
    `*${date}*`,
    degraded,
    RULE,
    `🔥 *THE SIGNAL*`,
    truncate(brief.theSignal.headline, 500),
    RULE,
    `📈 *WHAT'S MOVING*`,
    bullets(brief.whatsMoving, true),
    RULE,
    `💰 *MONEY MOVES*`,
    bullets(brief.moneyMoves),
    RULE,
    `📣 *WHO'S SPENDING*`,
    bullets(brief.whosSpending),
    RULE,
    `🎯 *WHO WE SHOULD TALK TO*`,
    bullets(brief.whoToTalkTo, true),
    RULE,
    `👀 *WATCH*`,
    bullets(brief.watch),
    RULE,
    `<${config.appUrl}|Open Deep Field →>`,
    `_${items.length} deduplicated signals · free-tier limits apply_`,
  ].filter(Boolean).join("\n");
}

export interface SlackResult { ok: boolean; error?: string; skipped?: boolean }

export async function sendToSlack(text: string): Promise<SlackResult> {
  if (!config.slack.webhookUrl) {
    return { ok: false, skipped: true, error: "No SLACK_WEBHOOK_URL configured" };
  }
  try {
    const res = await fetchWithTimeout(config.slack.webhookUrl, 10000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mrkdwn: true, unfurl_links: false, unfurl_media: false }),
    });
    if (!res.ok) return { ok: false, error: `Slack responded ${res.status}: ${truncate(await res.text(), 120)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}

export async function slackStatus(): Promise<{ connected: boolean; channel: string; note: string }> {
  const connected = Boolean(config.slack.webhookUrl);
  return {
    connected,
    channel: config.slack.channelLabel,
    note: connected
      ? "Incoming webhook configured"
      : "Add SLACK_WEBHOOK_URL to deliver the morning brief",
  };
}

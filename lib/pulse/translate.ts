import { completeJSON } from "@/lib/ai/client";
import type { ModelSlot } from "@/lib/ai/models";
import { languageOf } from "@/lib/language";
import type { Topic } from "@/lib/types";
import { noEmDash } from "@/lib/utils";

const SYSTEM = `You translate social media topic titles into natural English for a content team.
For each item, give a short English title (max 10 words) that says what the conversation is about, and translate the summary if it is not English. Keep names of people, places, shows and brands as they are. Do not add facts.
Return JSON only: {"items":[{"i": number, "title": "English title", "summary": "English summary"}]}
Never use em dashes.`;

/**
 * Put every topic's title into English. The model is told to write English
 * when it groups a scan, but when grouping falls back to keywords (a model's
 * free limit was used up), a topic is named after its top post, which can be
 * in Tamil, Hindi or Spanish. One small call per scan translates those, and
 * keeps the original so the topic page can show it. If no model can do it,
 * the titles stay as they are, labelled with their language.
 */
export async function translateTopics(topics: Topic[], slots: ModelSlot[]): Promise<number> {
  const todo = topics
    .map((t, i) => ({ t, i, lang: languageOf(t.title) }))
    .filter((x) => x.lang !== "English");
  if (!todo.length || !slots.length) return 0;
  const user = todo.map((x) => `[${x.i}] (${x.lang}) title: ${x.t.title}\nsummary: ${x.t.summary}`).join("\n\n");
  for (const slot of slots.slice(0, 3)) {
    try {
      const { data } = await completeJSON<{ items?: { i?: number; title?: string; summary?: string }[] }>(slot.id, SYSTEM, user, 2000);
      let done = 0;
      for (const it of data.items ?? []) {
        const t = typeof it.i === "number" ? topics[it.i] : undefined;
        const title = it.title?.trim();
        if (!t || !title || languageOf(title) !== "English" || !todo.some((x) => x.t === t)) continue;
        t.originalTitle = t.title;
        t.language ??= todo.find((x) => x.t === t)?.lang;
        t.title = noEmDash(title).slice(0, 120);
        if (it.summary?.trim()) t.summary = noEmDash(it.summary.trim());
        done++;
      }
      return done;
    } catch {
      // That model's limit is used up too; try the next.
    }
  }
  return 0;
}

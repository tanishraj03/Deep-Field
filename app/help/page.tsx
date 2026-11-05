import Link from "next/link";
import { Activity, ChevronDown, KeyRound, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { INTEGRATIONS } from "@/lib/keys-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Help & FAQ" };

const START = [
  { icon: KeyRound, title: "Add a free key", body: <>Open <Link href="/keys" className="text-accent hover:underline">Keys</Link> and add a Gemini key (free, about a minute). Tap the ⓘ next to any key for the steps.</> },
  { icon: Activity, title: "Read your Pulse", body: "Pulse shows what every niche is talking about right now. Your niches come first; tap one to see all its conversations." },
  { icon: Search, title: "Explore a topic", body: "Type any topic in Explore to see how big the conversation is this week, where it's happening, and whether it's worth making." },
  { icon: Sparkles, title: "Ask the assistant", body: "Ask what to make, why something is trending, or for hooks and scripts. It pulls live numbers and reads the threads before answering." },
];

const SCREENS = [
  { name: "Pulse", body: "The feed. Every conversation DeepField found across 20 niches, with real counts (threads, comments, upvotes, views), a heat score, whether it's new or rising, its India / Global split, and a verdict. Switch Everywhere / India / Global at the top. Use the arrow at the end of the niche row to scroll through niches." },
  { name: "Creators", body: "Per niche, India and global, this week or this month: the YouTube channels and Reddit posters behind what's taking off, each with a 0–100 score from reach, breakout (views against subscribers), relevance to what the niche is discussing and consistency. \"Viral\" marks a channel pulling at least 3× its subscribers in views. India means evidence the creator is Indian (the channel's country, its spoken language, an Indian-language title), not just appearing on India's chart. The month view builds up from daily scans." },
  { name: "Trending audio on Instagram", body: "A fold-out panel below the hottest conversations on Pulse. Global: this week's top Reels sounds (mostly US), with the format people use each for and how many Reels use it. India: Instagram doesn't chart India and nobody else does either, so it shows Spotify India's daily top songs, the songs Indian Reels are being made with." },
  { name: "Topic", body: "Open any conversation for its threads, the comments that explain why it's spreading, the questions people are asking and content angles. \"Ask the assistant\" opens a chat already loaded with it." },
  { name: "Explore", body: "Search any topic across Reddit, YouTube, Hacker News, news, Wikipedia, Bluesky, Mastodon and Lemmy. You get conversations per day and per source, the top communities, the actual threads, and an AI read with a verdict." },
  { name: "Assistant", body: "A chat with the model of your choice (switch in the picker). It has tools: it reads the latest scan, runs Explore searches and reads threads, so its answers cite live numbers. Chats are kept in this browser." },
  { name: "Track record", body: "Everything you marked \"I made this\", and how it did. Tell DeepField how each post went against your usual; your results and other creators' are how the verdicts learn." },
  { name: "Keys", body: "Where your own keys live. Each key says what it unlocks and how to get it." },
  { name: "Settings", body: "Which data sources are working, which models your keys unlock, and when each niche was last scanned." },
];

const SCORES = [
  { name: "Heat (0–100)", body: "How hot a conversation is right now: reactions (comments, upvotes, views) weigh most, plus how many threads and communities it spans and how many posts arrived in the last 24 hours. Reaction counts in full for three days, then fades (a week-old thread counts a quarter), and a story that has sat on the feed for days without new threads cools off. One scale across all niches." },
  { name: "Virality (0–100)", body: "How fast it's spreading now: reactions per hour over the last few days, plus how hard the average post lands. A small conversation can be very viral; a story that has gone quiet cools here too." },
  { name: "Verdict", body: "Make now, Worth testing or Skip, from virality, heat, momentum, freshness and how crowded YouTube already is. It is deliberately strict: most topics are a test or a skip, and \"make now\" is rare. As creators report how their posts did, verdicts in a niche lean towards what actually worked; when that happens, the verdict says so." },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: "Why do I need my own keys?", a: "So nobody spends anyone else's credits. Every model call, YouTube search and Reddit request you trigger runs on your keys only, and your keys are only ever used for your requests. The keys you need for the AI are free." },
  { q: "Which key should I add first?", a: <>Gemini. It's free with no card, and it unlocks the assistant, AI-named conversations when you rescan, Explore insights and the picked-out comments. Add YouTube next if you want view counts. <Link href="/keys" className="text-accent hover:underline">Add keys</Link></> },
  { q: "What works without any keys?", a: "Reading Pulse, opening topics, and Explore searches across Reddit, Hacker News, news, Wikipedia, Bluesky, Mastodon and Lemmy. The assistant, AI insights and rescanning need an AI key; YouTube numbers need a YouTube key." },
  { q: "Are my keys safe?", a: "They're checked with the provider, encrypted before they're stored, and only used on the server. They never come back to your browser: the Keys page only shows the last four characters. Remove a key any time, and revoke it at the provider for good measure." },
  { q: "Can I be charged?", a: "Not by the free providers (Gemini, Groq, Cerebras, OpenRouter's free models, Mistral's Experiment plan) as long as you don't attach billing to them. Grok is the only paid model: it spends your xAI credits, and only when you pick it in the assistant. Background work never uses a paid model." },
  { q: "Why can't I rescan?", a: "Rescanning needs an AI key of your own. Scans are shared by everyone, and an AI key is what turns raw threads into named conversations. A niche also isn't rescanned more often than every 10 minutes. Scans run on the server, so you can leave the page or close the tab and they still finish." },
  { q: "Does DeepField learn from people using it?", a: <>Yes, in three ways. Under every verdict you can say whether the call is right. When you make something, press <span className="font-medium text-ink">I made this</span>, then report how it did on <Link href="/made" className="text-accent hover:underline">Track record</Link>. Once a niche has enough results or votes, its verdicts lean towards what worked, by at most 7 points, and the verdict lists it as a reason. And Pulse shows what creators are searching in Explore, without names, once several different people have searched the same thing.</> },
  { q: "Can anyone see what I search?", a: "No. Searches are counted without your name, in a way that can't be traced back to you, and a phrase only appears under \"Creators are researching\" once at least two different people searched it. Nobody can see who searched what, the admin included." },
  { q: "My niche is missing a community. Can I add it?", a: "Yes. Open the niche on Pulse and press \"Suggest a community\" under \"Where the conversation happens\". It's checked on the spot (it must exist, be safe for work and active), then reviewed. Once approved, every scan of that niche reads it." },
  { q: "Why did a topic drop down the feed?", a: "Heat measures what's hot now, so older threads fade and a story that has lingered for days without new threads cools off. Lists across niches also show at most two topics per niche and avoid repeating the same story or theme, so one big story can't fill the page." },
  { q: "Is the feed the same for everyone?", a: <>The conversations are shared, but the order isn&apos;t: your niches come first, the region filter opens on your audience, and lists sort by heat or virality as you chose. Change your answers under <Link href="/welcome?edit=1" className="text-accent hover:underline">Feed preferences</Link>.</> },
  { q: "Why are some numbers blank?", a: "Nothing is estimated. If a platform didn't report a number, DeepField leaves it blank rather than guessing. The most common case is brand-new Reddit threads (see the next question)." },
  { q: "Why do new Reddit threads have no upvotes or comments yet?", a: "Reddit's upvote and comment counts only reach DeepField accurately about 36 hours after a thread is posted. Before that they read close to zero. So for threads younger than about 36 hours, DeepField counts the thread itself (it still adds to how big and how fast a conversation is) but leaves its upvotes and comments blank and labels it as not yet measured, instead of showing a misleading zero. After about a day and a half the real numbers appear on the next scan. Reddit's own API would give live counts straight away, but since late 2025 Reddit has to approve each app by hand, so most people can skip it." },
  { q: "The assistant says the free limit is used up. What now?", a: "Free tiers allow a set number of requests a minute or a day. Switch to another model in the picker (add a Groq key for a fast backup), or wait a minute." },
  { q: "A key I saved stopped working.", a: "The provider may have revoked it or the free quota ran out. Replace it on the Keys page; it's checked again before it's saved." },
  { q: "How do I change my username or answers?", a: <>Open your account menu and choose <Link href="/welcome?edit=1" className="text-accent hover:underline">Feed preferences</Link>. Every question can be skipped.</> },
];

export default async function HelpPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Help & FAQ</h1>
        <p className="mt-1 text-sm text-muted">How to use DeepField to decide what to make content about.</p>
      </div>

      <section>
        <Eyebrow className="mb-3">Get started</Eyebrow>
        <div className="grid gap-3 sm:grid-cols-2">
          {START.map((s, n) => (
            <Card key={s.title} className="p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-hair/[0.06]"><s.icon className="h-3.5 w-3.5 text-muted" /></span>
                <p className="font-medium"><span className="num text-faint">{n + 1}.</span> {s.title}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Eyebrow className="mb-3">The screens</Eyebrow>
        <Card className="divide-y">
          {SCREENS.map((s) => (
            <div key={s.name} className="grid gap-1 p-4 sm:grid-cols-[8rem_1fr]">
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <Eyebrow className="mb-3">Reading the scores</Eyebrow>
        <Card className="divide-y">
          {SCORES.map((s) => (
            <div key={s.name} className="grid gap-1 p-4 sm:grid-cols-[8rem_1fr]">
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <Eyebrow className="mb-3">Keys at a glance</Eyebrow>
        <Card className="divide-y">
          {INTEGRATIONS.map((i) => (
            <div key={i.id} className="grid gap-1 p-4 sm:grid-cols-[11rem_1fr]">
              <p className="font-medium">{i.name}<span className="mt-0.5 block text-xs font-normal text-faint">{i.cost}</span></p>
              <p className="text-sm text-muted">{i.unlocks}.</p>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-faint">Step-by-step instructions for each are behind the ⓘ on the <Link href="/keys" className="underline-offset-2 hover:underline">Keys</Link> page.</p>
      </section>

      <section>
        <Eyebrow className="mb-3">FAQ</Eyebrow>
        <Card className="divide-y">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </Card>
      </section>

      <p className="flex items-center justify-center gap-1.5 pb-4 text-xs text-faint">
        <SlidersHorizontal className="h-3.5 w-3.5" />Want a different feed? <Link href="/welcome?edit=1" className="text-muted underline-offset-2 hover:underline">Update your answers</Link>
      </p>
    </div>
  );
}

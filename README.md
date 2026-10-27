# DeepField

**What is the internet talking about — in every niche, in India and globally — and what should we make content about?**

DeepField scouts Reddit, Hacker News, YouTube, news, Wikipedia, Google Trends, Bluesky and Mastodon, groups what it finds into *conversations*, measures how big each one is, and gives you an AI research assistant to dig into any of them.

| Screen | What it answers |
|---|---|
| **Pulse** | What's being talked about right now, across 20 niches. Every conversation has real counts (threads, comments, upvotes, views), a heat score, whether it's new or rising, an India/Global split, the questions people are asking and content angles. Filter to India or Global. |
| **Explore** | Type any topic. Get how many conversations happened this week, per source and per day, where (communities, India vs global), Wikipedia attention, the actual threads, and an AI read: sub-conversations, sentiment, questions, angles and a verdict. |
| **Assistant** | Chat with a model of your choice. It has tools: it reads the latest scan, runs Explore searches and reads Reddit threads — so answers are grounded in live numbers, not memory. |
| **Sources** | Which sources are working, which keys are set, when each niche was last scanned. |

## Run it

```bash
npm install
cp .env.example .env.local     # add GEMINI_API_KEY at minimum (free)
npm run dev                    # http://localhost:3000
```

Open Pulse and press **Run the first scan** — it walks every niche (about 20–30s each) and results appear as they land. Or from the terminal, with no time limit:

```bash
npm run scan                   # all niches + spiking signals
npm run scan -- money food     # just these
npm run scan -- --no-ai        # keyword grouping, no model calls
```

## Models

Switch models from the picker in the assistant. Each is tagged with what it's best at:

| Model | Tag | Key | Cost |
|---|---|---|---|
| Gemini Flash | **Best overall** | `GEMINI_API_KEY` | Free |
| Gemini Flash-Lite | Highest free limits | `GEMINI_API_KEY` | Free |
| Qwen 3.8 · Groq | **Fastest** | `GROQ_API_KEY` | Free |
| GPT-OSS 120B · Groq | **Best free reasoning** | `GROQ_API_KEY` | Free |
| Cerebras | Ultra-fast | `CEREBRAS_API_KEY` | Free (short context) |
| OpenRouter Free | Most variety | `OPENROUTER_API_KEY` | Free, 50/day |
| Mistral Medium | Strong writing | `MISTRAL_API_KEY` | Free Experiment plan |
| Grok | Sharp on internet culture | `XAI_API_KEY` | **Paid** (xAI credits) |

Free-tier model ids change often, so each entry lists candidates and the first one the provider still serves is used (checked against its live `/models` list). Background work — grouping scans and writing Explore insights — only ever uses free models, and falls through to the next free model when one is overloaded.

## Where the numbers come from

- **Reddit** — ~1,600 communities across 20 niches (up to 100 each), split India / Global: a hand-picked core in `lib/niches.ts` plus communities found by `scripts/discover-communities.ts` (checked to exist, be safe for work, be on-topic and post at least daily; saved in `lib/communities.json`). Each scan reads the busiest ~16 per niche in depth and the rest with one request, through a shared limiter that keeps the archive at a few requests a second. Read through the [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift) archive because Reddit's JSON blocks anonymous clients and its RSS rate-limits within a few requests. Archive counts are accurate once a thread is ~36h old (checked against Reddit: 225 vs 218 comments); newer threads count as volume and are labelled. Set `REDDIT_CLIENT_ID/SECRET` to use Reddit's own API with live counts.
- **Hacker News** (Algolia), **GDELT** and **Google News** (articles per topic, top stories sized by outlets), **Wikipedia** pageviews (incl. most-read in India), **Google Trends** trending searches (IN/US), **Bluesky** (trending and post search), **Mastodon** (trending tags and shared links) and **Lemmy** — all keyless.
- **X** — trending in India and worldwide, read from getdaytrends.com's public tracker. X has no free read API and scraping X itself breaks its terms.
- **YouTube** — trending per category and most-viewed uploads per topic. Free key: `YOUTUBE_API_KEY`.
- **Instagram** — optional: top posts for a hashtag through Meta's official API with your own Business/Creator account (`INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`). TikTok publishes nothing comparable without paid access, so Explore links out to it.

Nothing is estimated: a number a platform didn't report is left blank.

**Heat** (0–100) is one scale across all niches: reaction (comments, upvotes, views) weighted most, plus number of threads and communities and velocity (threads in the last 24h), on log scales so one mega-thread can't drown out a conversation happening everywhere.

**Virality** (0–100) is how fast a conversation is spreading: reactions (comments + upvotes/likes + views/100) per hour since its first post, plus how hard the average post lands.

**Verdict** — every topic and Explore search gets *Make now*, *Worth testing* or *Skip*, cut from an opportunity score built on virality, heat, momentum, freshness and how crowded YouTube already is. In Explore the AI may move that score by at most 15 points, with reasons, so a fading or saturated topic can't be talked into "make now". Run `npx tsx scripts/score-report.ts` to see how the calls spread across the latest scans.

## Daily scan

A GitHub Actions workflow (`.github/workflows/scan.yml`) wakes hourly and asks the app whether today's scan is due; the time is set in **Settings → Daily scan** (default 9:00 AM IST). It needs two repository secrets: `APP_URL` (the deployed site) and `CRON_SECRET` (the same value as in Vercel).

## Deploy

1. Push to GitHub, import into Vercel, add the variables from `.env.local` (`./scripts/vercel-env.sh` does it for you).
2. Optional: Supabase for storage that survives redeploys — run `supabase/schema.sql`, set `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Without it, Vercel keeps data only per instance.
3. Scheduled scans: add `APP_URL` and `CRON_SECRET` as GitHub Actions secrets. `.github/workflows/scan.yml` rescans every niche four times a day.

## Layout

```
app/                    Pulse (/), topic/[niche]/[id], explore, assistant, sources, api/*
components/             Screens and UI (pulse, topic-view, explore-view, assistant, model-picker, charts)
lib/niches.ts           ★ The niche catalogue: communities per niche, India and Global
lib/sources/            One module per source (arctic, reddit, hackernews, youtube, news, wikipedia, trends, social)
lib/pulse/              Scan a niche → cluster into conversations → score heat
lib/explore/            Search any topic across sources; AI insight
lib/ai/                 Model registry, one OpenAI-compatible client, prompts, assistant tools
lib/store.ts            Key-value store: Supabase or a local file
scripts/scan.ts         Command-line scan; scripts/check-niches.ts validates communities
```

Add a niche or a community by editing `lib/niches.ts`, then `npm run check:niches` to confirm every community is alive.

# Deep Field

*Point it at an empty patch of the internet and wait. Things resolve.*

Every morning this answers three questions:

**What's moving?** — emerging social trends and cultural signals
**Who's spending?** — companies showing increased marketing activity
**Who should we talk to?** — newly funded, newly launching, creator-compatible companies

It collects from public feeds, deduplicates, scores deterministically, uses a free AI model
only for interpretation, writes a three-minute brief, and posts it to Slack at 8:00 AM IST.

**Recurring cost: ₹0 / $0.** That is an architectural constraint, not an aspiration —
`npm run cost:audit` fails the build if anything in the tree can generate a charge.

---

## 1. What it costs, service by service

| Layer | Service | Plan | Card required? | Can it bill you? |
|---|---|---|---|---|
| Hosting | Vercel | Hobby | No | No |
| AI | Google AI Studio (Gemini) | Free tier | No | No — Flash models only |
| Database | Supabase | Free | No | No |
| Automation | GitHub Actions | Free minutes | No | No — standard runners only |
| Delivery | Slack incoming webhook | Free | No | No |
| Data | 32 public RSS feeds + keyless APIs | Free | No | No |

Nothing here has a metered overage path. If a free quota runs out, the app reduces
coverage and says so. It never falls back to a paid service.

---

## 2. Get it running for $0

### Step 1 — Clone and install

```bash
git clone <your-repo-url> deep-field
cd deep-field
npm install
```

### Step 2 — Run it immediately, with no keys at all

```bash
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. First run drops you into **Build your intelligence feed** —
four questions (regions, platforms, industries, Slack) that define what you see. It is
skippable, stored in your browser only, and rebuildable any time from Settings.

After that, `MOCK_DATA=true` is the default, so the entire product — every screen, filter,
score and brief — works on realistic invented data. A **Mock data** badge appears on Today
so demo data is never mistaken for intelligence.

Stop here if you only want to look at it.

### Step 3 — Create a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Sign in with a Google account and click **Create API key**
3. Copy it into `.env.local`:

```env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-2.5-flash
MOCK_DATA=false
```

**Do not add a billing account.** The free tier does not need one.

Free-tier model IDs change. As of 2026 the free tier covers **Flash and Flash-Lite models
only** — Pro models are paid. Two protections are built in:

- `FREE_ONLY=true` refuses to build a request for any Pro/Ultra model, with a red
  **BLOCKED — PAID SERVICE** banner in Settings.
- If your configured model ID has been retired, the app queries the models endpoint and
  picks a free-tier Flash model itself rather than failing.

### Step 4 — Configure the free Supabase database *(optional)*

Skip this and the app uses a bundled local store. You lose day-over-day novelty tracking
on Vercel (serverless filesystems reset), so the "what changed since yesterday" engine
works best with Supabase.

1. Create a free project at https://supabase.com — no card required
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, run it
3. From **Settings → API**, copy the URL and the **service_role** key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

The service key is read only in server code and is never sent to the browser.

> Free Supabase projects pause after a week of inactivity. The daily cron keeps yours awake.

### Step 5 — Connect Slack

1. https://api.slack.com/apps → **Create New App → From scratch**
2. **Incoming Webhooks** → toggle on → **Add New Webhook to Workspace**
3. Pick your channel, copy the webhook URL:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T000/B000/xxxx
SLACK_CHANNEL_LABEL=#intelligence
```

Test it from **Settings → Briefing → Send test to Slack**. No Zapier, no Make, no
automation platform — one HTTP POST to a free webhook.

### Step 6 — Set the remaining environment variables

```bash
openssl rand -hex 32   # use the output as CRON_SECRET
```

```env
FREE_ONLY=true
CRON_SECRET=<the value you just generated>
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

`CRON_SECRET` stops anyone who finds your URL from triggering ingestion and burning
your AI quota.

### Step 7 — Run locally

```bash
npm run dev                                    # interface
curl -X POST localhost:3000/api/ingest \
  -H "Authorization: Bearer $CRON_SECRET"      # one collection run
```

### Step 8 — Deploy to Vercel

1. Push to GitHub
2. https://vercel.com/new → import the repo → framework auto-detects as Next.js
3. Paste every variable from `.env.local` into **Environment Variables**
4. Deploy

Stay on **Hobby**. Do not enable paid Observability, Edge Config or Analytics add-ons —
nothing in this codebase uses them.

### Step 9 — Turn on the scheduler

In your GitHub repo, **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `APP_URL` | `https://your-app.vercel.app` |
| `CRON_SECRET` | the same value as in Vercel |

`.github/workflows/daily-intelligence.yml` then runs four short jobs a day:

| IST | UTC cron | Stage |
|---|---|---|
| 06:00 | `30 0 * * *` | Collect from all sources |
| 07:00 | `30 1 * * *` | Analyse and score |
| 07:30 | `0 2 * * *` | Write the brief |
| 08:00 | `30 2 * * *` | Deliver to Slack |

Each takes seconds. Public repos get unlimited free minutes; private repos on GitHub Free
get a monthly allowance this uses a rounding error of. The workflow pins
`runs-on: ubuntu-latest` — never a larger paid runner.

### Step 10 — Test the whole chain

**Actions → Deep Field — Daily Brief → Run workflow → stage: `deliver`.**
The brief should land in Slack within a minute, and the run summary shows exactly what
was collected, deduplicated and skipped.

---

## 3. How it works

```
32 public sources
      ↓  collect        one polite request each, 9s timeout, failures recorded not fatal
   ~120 raw items
      ↓  deduplicate    canonical URL → company+window → title similarity
   ~60 unique events
      ↓  classify       regex lanes: funding / marketing / trend
      ↓  extract        amounts, rounds, investors — read from text or left null
      ↓  filter + rank  relevance ≥ 0.35, sorted by novelty
   ~25 relevant items
      ↓  AI             top 24 only, one call each, hard quota valve
      ↓  score          deterministic weights, every component shown
   ~10 important signals
      ↓  brief          2 model calls total
      ↓  Slack
```

**Code does the work; AI does the interpretation.** Deduplication, date filtering,
scoring and sorting are plain TypeScript. That is what keeps a daily run inside the free
tier — a typical morning is about 25 model calls against a cap of 144.

### Verify it yourself

```bash
npm run cost:audit             # fails if anything can bill you
npx tsx scripts/verify-core.ts # 40 assertions on dedup, extraction, scoring, profiles
npx tsx scripts/degrade-test.ts # simulates every source failing at once
```

---

## 4. What it will not do

These are enforced in code, not just documented.

- **Never invents a number.** A funding amount is `null` unless it was parsed out of
  source text. Undisclosed rounds display *Not publicly disclosed*.
- **Never states marketing spend.** It reports *Marketing activity ↑ HIGH* with the list
  of observable signals behind it. A figure appears only when a publication printed one,
  with a link to it.
- **Never claims a platform said something.** Without access to Instagram or TikTok
  internals, items are labelled `SOCIAL SIGNAL`, `PUBLIC WEB SIGNAL`, `EARLY SIGNAL` or
  `REPORTED` by provenance. `REPORTED` requires a company announcement or two
  independent publications.
- **Never presents interpretation as fact.** Model output is tagged *AI interpretation*;
  scores computed without measured evidence show *AI-estimated*.
- **Never hides a failure.** "3 sources unavailable" appears on every screen rather than
  a clean-looking but thinner feed.
- **Never hides its own filtering.** The feed you build at setup is named on every screen
  it affects, with the count it is hiding and a one-click way to see everything. A filter
  nobody can see is indistinguishable from missing data.
- **Never fills a company profile with plausible detail.** Profiles are assembled only
  from items already collected — nothing is fetched on demand, and every profile ends with
  an explicit *What we don't know*: undisclosed amounts, unnamed investors, absent spend
  figures, and the categories no free public source provides.
- **Never scrapes.** Public feeds and documented keyless APIs only. No CAPTCHA solving,
  no auth bypass, no paywall circumvention, no anti-bot evasion. A 429 means that source
  is done for the day.

---

## 5. Repository layout

```
app/                     Screens and API routes
  page.tsx               TODAY — the Control Centre
  welcome/               First run — build your intelligence feed
  company/[slug]/        Company profile, assembled from items already held
  signals/ money/ spend/ opportunities/ saved/ brief/
  settings/diagnostics/  Source health, quota, last ingestion
  api/ingest/            The one endpoint the scheduler calls
components/              Interface. cards.tsx, today.tsx, ui.tsx
lib/
  config.ts              ★ Single source of truth for "can this cost money?"
  sources/               One adapter per source kind + the feed registry
  ingestion/             Pipeline, classification, fact extraction
  dedup/                 Three-pass event clustering
  scoring/               Trend + opportunity models, weights fixed
  company.ts             Pure profile derivation — a view over items, no fetching
  prefs.ts               The feed built at setup, applied as a visible filter
  ai/                    Provider interface, Gemini free, rules fallback, quota valve
  db/                    Repository interface, Supabase, local fallback
  slack/  brief/  mock/
scripts/                 cost-audit, verify-core, degrade-test
supabase/schema.sql      Free-tier schema with pruning built in
.github/workflows/       Daily scheduler
```

### Swapping pieces later

Every replaceable thing sits behind an interface:

- **AI** — implement `AIProvider` (`lib/ai/provider.ts`). Six methods.
- **Database** — implement `Repository` (`lib/db/types.ts`).
- **Sources** — add a row to `lib/sources/registry.ts`, or a new adapter for a new kind.

Nothing in the pipeline knows which implementation it is using.

---

## 6. Free-tier reality

Free infrastructure does not mean unlimited data, and the interface says so on every
screen. When a quota runs out the app reduces coverage and keeps going:

| Quota exhausted | What happens |
|---|---|
| Gemini daily cap | AI stops at 80% of the cap. Collection, dedup and scoring continue. The brief is written from rules and labelled *Rules only*. |
| A source rate-limits | That source is skipped for the day and counted in "sources unavailable". No retry into the limit. |
| Supabase unreachable | Falls back to the local store and flags it as non-persistent in Settings. |
| No AI key at all | Everything works except interpretation. |

Adjust the valves in `.env.local`:

```env
AI_MAX_REQUESTS_PER_DAY=180
AI_SAFETY_THRESHOLD=0.8    # stop at 80% of the cap
```

---

## 7. Security

- `.env.local` is gitignored. `.env.example` holds placeholders only.
- The Gemini key, Supabase service key and Slack webhook are read exclusively in server
  code — none is prefixed `NEXT_PUBLIC_` and none reaches the browser bundle.
- `/api/ingest` and `/api/brief` require `Authorization: Bearer $CRON_SECRET`.
- Row-level security is on for every Supabase table; no anon key is issued.

**Do not add a billing method to any service unless that service absolutely requires it
to function.** None of the services above does.

---

## 8. Build phases

The repository is complete, but if you are extending it, this is the order the pieces
depend on each other in:

1. Frontend on mock data → 2. Database → 3. Free-source ingestion → 4. Deduplication →
5. Gemini connection → 6. AI analysis → 7. Opportunity scoring → 8. Daily brief →
9. Slack → 10. GitHub Actions → 11. Vercel → 12. Full free-workflow test

---

## Licence

MIT. Do what you like with it.

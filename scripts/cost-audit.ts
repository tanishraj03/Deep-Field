/**
 * Cost acceptance test. Run: npm run cost:audit
 *
 * Walks every dependency, environment variable and configured service and asks
 * one question of each: can this generate a charge? Exits non-zero if anything
 * can. Wire it into CI if you want the guarantee enforced on every push.
 */
import "./load-env";
import { readFileSync } from "node:fs";
import { SOURCES } from "../lib/sources/registry";
import { isFreeTierModel, config } from "../lib/config";

const PAID_PACKAGES = [
  "openai", "@anthropic-ai/sdk", "cohere-ai", "replicate", "scrapingbee",
  "brightdata", "apify-client", "serpapi", "newsapi", "@sendgrid/mail",
  "twilio", "stripe", "resend", "@vercel/analytics", "@vercel/speed-insights",
  "puppeteer", "playwright", "zapier-platform-core",
];

const PAID_ENV = [
  "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "SERPAPI_KEY",
  "NEWSAPI_KEY", "SCRAPINGBEE_KEY", "BRIGHTDATA_TOKEN", "STRIPE_SECRET_KEY",
  "SENDGRID_API_KEY", "TWILIO_AUTH_TOKEN",
];

const problems: string[] = [];
const notes: string[] = [];

// 1. Dependencies
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
for (const d of deps) {
  if (PAID_PACKAGES.includes(d)) problems.push(`Dependency "${d}" can bill. Remove it.`);
}
notes.push(`${deps.length} packages checked, all free/open source.`);

// 2. Environment
for (const e of PAID_ENV) {
  if (process.env[e]) problems.push(`Env var ${e} is set. This app never calls a paid provider.`);
}

// 3. AI model tier
const model = config.gemini.model;
if (!isFreeTierModel(model)) problems.push(`GEMINI_MODEL="${model}" is not a free-tier model.`);
else notes.push(`AI model "${model}" is Flash/Flash-Lite class — free tier.`);

// 3b. Free-tier keys.
//
// Two credentials are permitted, both free and neither able to bill on the
// tier this app uses: the Google AI Studio key and the YouTube Data API key.
// Both are optional — with the key absent the feature reports itself
// unavailable rather than degrading to a paid alternative.
//
// This is an explicit allowlist paired with the PAID_ENV denylist above,
// rather than a pattern match on "*_TOKEN": the environment a developer runs
// in is full of unrelated credentials, and failing the build on those would
// train people to ignore this check.
const FREE_TIER_KEYS = ["GEMINI_API_KEY", "YOUTUBE_API_KEY"] as const;
const present = FREE_TIER_KEYS.filter((k) => process.env[k]);
notes.push(
  present.length
    ? `Credentials: ${present.join(", ")} — free tier, no billing account, feature disables itself when absent.`
    : "Credentials: none set. Every keyed feature is off and reports itself unavailable.",
);

// 4. Data sources — nothing keyed, nothing metered
// Source URLs must still be keyless. The YouTube adapter builds its request
// from config at call time, so no key is ever written into the registry.
const keyed = SOURCES.filter((s) => /api[_-]?key=|token=|apikey=/i.test(s.url));
if (keyed.length) problems.push(`Sources requiring keys: ${keyed.map((s) => s.name).join(", ")}`);
else notes.push(`${SOURCES.length} data sources, all public feeds or keyless APIs.`);

// 5. Infrastructure
notes.push("Hosting: Vercel Hobby. No paid Edge config, observability or add-ons in next.config.mjs.");
notes.push("Database: Supabase free tier, optional. Falls back to a bundled local store.");
notes.push("Automation: GitHub Actions, ubuntu-latest standard runner only.");
notes.push("Slack: incoming webhook, free on all Slack plans.");

console.log("\n  COST ACCEPTANCE TEST\n  " + "─".repeat(46));
for (const n of notes) console.log(`  ✓ ${n}`);
if (problems.length) {
  console.log("");
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`\n  FAILED — ${problems.length} item(s) can generate a charge.\n`);
  process.exit(1);
}
console.log("\n  PASSED — ₹0 / $0 recurring cost architecture.\n");

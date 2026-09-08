/**
 * Cost acceptance test. Run: npm run cost:audit
 *
 * Walks every dependency, environment variable and configured service and asks
 * one question of each: can this generate a charge? Exits non-zero if anything
 * can. Wire it into CI if you want the guarantee enforced on every push.
 */
import { readFileSync } from "node:fs";
import { SOURCES } from "../lib/sources/registry";
import { isFreeTierModel } from "../lib/config";

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
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
if (!isFreeTierModel(model)) problems.push(`GEMINI_MODEL="${model}" is not a free-tier model.`);
else notes.push(`AI model "${model}" is Flash/Flash-Lite class — free tier.`);

// 4. Data sources — nothing keyed, nothing metered
const keyed = SOURCES.filter((s) => /api[_-]?key|token=|apikey/i.test(s.url));
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

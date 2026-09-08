/**
 * Loads .env.local / .env into process.env as a side effect.
 *
 * Next.js does this at runtime; the plain-tsx scripts do not, which meant
 * `npm run cost:audit` was auditing the committed defaults rather than the
 * configuration that actually runs. Import this FIRST, before anything that
 * reads config, so a paid model or paid key set only in .env.local is caught.
 *
 * Real environment variables always win over file values.
 */
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  const path = new URL(`../${file}`, import.meta.url);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    if (process.env[k] === undefined) process.env[k] = t.slice(i + 1).trim();
  }
}

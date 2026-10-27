/** Smoke-test the signal and search sources once each. Read-only. `npx tsx scripts/try-sources.ts` */
import "./load-env";
import * as gnews from "@/lib/sources/googlenews";
import * as social from "@/lib/sources/social";
import * as xtrends from "@/lib/sources/xtrends";

async function main() {
  const show = async (name: string, fn: () => Promise<{ title: string; measure?: string; score?: number; comments?: number }[]>) => {
    try {
      const got = await fn();
      console.log(`${name}: ${got.length}`, got.slice(0, 3).map((g) => `${g.title.slice(0, 50)} [${g.measure ?? `${g.score ?? "-"}↑ ${g.comments ?? "-"}💬`}]`));
    } catch (e) { console.log(`${name}: FAILED ${(e as Error).message}`); }
  };
  await show("X India", () => xtrends.trending("IN"));
  await show("X world", () => xtrends.trending("GLOBAL"));
  await show("GNews IN top", () => gnews.topStories("IN"));
  await show("GNews search", () => gnews.search("iphone duo", false));
  await show("Masto links", () => social.mastodonLinks());
  await show("Lemmy", () => social.lemmySearch("iphone duo"));
  await show("Bluesky", async () => (await social.blueskySearch("iphone duo")).posts);
}
main();

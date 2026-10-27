/** Smoke-test Wikipedia matching and the Reddit read-and-match fallback. Read-only. */
import "./load-env";
import { NICHES } from "@/lib/niches";
import { attention } from "@/lib/sources/wikipedia";
import { searchReddit } from "@/lib/sources/reddit";

async function main() {
  for (const q of ["diwali sale", "met gala", "iphone duo", "creatine"]) {
    const a = await attention(q).catch((e) => ({ article: `ERR ${(e as Error).message}`, daily: [] }));
    console.log(`wiki "${q}" → ${a ? `${a.article} (${a.daily.reduce((x, d) => x + d.views, 0)} views/30d)` : "no matching article"}`);
  }
  // Force the fallback by pointing the RSS search at nothing: call with a bogus scope.
  const india = [...new Set(NICHES.flatMap((n) => n.core.IN.slice(0, 2)))].slice(0, 30);
  const t = Date.now();
  const r = await searchReddit(process.argv[2] ?? "diwali", { within: ["__no_such_sub__"], fallbackSubs: india }).catch((e) => ({ posts: [], via: "error", note: (e as Error).message }));
  console.log(`reddit India "${process.argv[2] ?? "diwali"}": ${r.posts.length} posts via ${r.via} in ${((Date.now() - t) / 1000).toFixed(1)}s ${r.note ?? ""}`);
  console.log(r.posts.slice(0, 5).map((p) => `${p.community}: ${p.title.slice(0, 60)}`));
}
main();

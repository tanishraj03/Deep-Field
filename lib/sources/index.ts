import { rssAdapter } from "./rss";
import { redditAdapter } from "./reddit";
import { trendsAdapter } from "./trends";
import { hnAdapter } from "./hn";
import { youtubeAdapter } from "./youtube";
import type { SourceAdapter, SourceDefinition } from "./types";

const ADAPTERS: Record<SourceDefinition["kind"], SourceAdapter> = {
  rss: rssAdapter,
  reddit: redditAdapter,
  trends: trendsAdapter,
  hn: hnAdapter,
  youtube: youtubeAdapter,
};

export function adapterFor(def: SourceDefinition): SourceAdapter {
  return ADAPTERS[def.kind];
}

export { SOURCES, enabledSources } from "./registry";
export type { SourceDefinition, SourceAdapter } from "./types";

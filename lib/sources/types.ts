import type { Category, Platform, RawItem, Region, SourceType } from "@/lib/types";

export interface SourceDefinition {
  id: string;
  name: string;
  url: string;
  kind: "rss" | "reddit" | "trends" | "hn";
  sourceType: SourceType;
  region: Region;
  platform: Platform;
  categories: Category[];
  /** What this feed is for. Drives which pipeline lane the item enters. */
  lane: "funding" | "marketing" | "social" | "platform" | "mixed";
  enabled: boolean;
}

export interface SourceAdapter {
  kind: SourceDefinition["kind"];
  fetch(def: SourceDefinition): Promise<RawItem[]>;
}

"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "df-outreach";

export type OutreachStatus = "none" | "researching" | "contacted" | "talking" | "passed";

export const OUTREACH_LABEL: Record<OutreachStatus, string> = {
  none: "Not started",
  researching: "Researching",
  contacted: "Reached out",
  talking: "In conversation",
  passed: "Passed",
};

/**
 * Outreach state lives in the browser so the product works with no database.
 * The outreach_status table in supabase/schema.sql holds the same shape when
 * a database is configured — Repository is the seam to move this behind.
 */
export function useOutreach() {
  const [map, setMap] = useState<Record<string, OutreachStatus>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setMap(JSON.parse(raw) as Record<string, OutreachStatus>);
    } catch {}
  }, []);

  const set = useCallback((slug: string, status: OutreachStatus) => {
    setMap((prev) => {
      const next = { ...prev };
      if (status === "none") delete next[slug];
      else next[slug] = status;
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { map, set, statusOf: (slug: string): OutreachStatus => map[slug] ?? "none" };
}

"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "df-saved";

/**
 * Saved opportunities live in the browser so the product works with no database.
 * When Supabase is configured, POST /api/data can be extended to mirror these —
 * the storage contract is already in Repository.toggleSaved.
 */
export function useSaved() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setIds(JSON.parse(raw) as string[]);
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { ids, toggle, isSaved: (id: string) => ids.includes(id) };
}

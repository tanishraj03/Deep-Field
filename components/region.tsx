"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { RegionFilter } from "@/lib/types";

/**
 * The India / Global filter, shared by every screen and remembered between
 * visits — switching region on Pulse should still hold when you open Explore.
 */
const Ctx = createContext<{ region: RegionFilter; setRegion: (r: RegionFilter) => void }>({
  region: "ALL", setRegion: () => {},
});

const VALID = new Set<RegionFilter>(["ALL", "IN", "GLOBAL"]);

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setState] = useState<RegionFilter>("ALL");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("df-region") as RegionFilter | null;
      if (saved && VALID.has(saved)) setState(saved);
    } catch {}
  }, []);
  const setRegion = useCallback((r: RegionFilter) => {
    setState(r);
    try { localStorage.setItem("df-region", r); } catch {}
  }, []);
  return <Ctx.Provider value={{ region, setRegion }}>{children}</Ctx.Provider>;
}

export const useRegion = () => useContext(Ctx);

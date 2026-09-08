"use client";

import { motion } from "framer-motion";
import { AutoCard } from "./cards";
import { Empty, Eyebrow, stagger } from "./ui";
import { useSaved } from "./saved";
import type { Snapshot } from "@/lib/types";

export function SavedView({ snapshot }: { snapshot: Snapshot }) {
  const { ids, toggle, isSaved } = useSaved();
  const items = snapshot.items.filter((i) => ids.includes(i.id));

  return (
    <div className="space-y-6">
      <header>
        <Eyebrow>Shortlist</Eyebrow>
        <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">Saved</h1>
        <p className="readout mt-2 text-[0.75rem] text-faint">
          {items.length} saved · kept in this browser
        </p>
      </header>

      {items.length === 0 ? (
        <Empty
          title="Nothing saved yet."
          action="Save an opportunity from any card and it will wait for you here."
        />
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          {items.map((i) => <AutoCard key={i.id} item={i} saved={isSaved(i.id)} onToggle={toggle} />)}
        </motion.div>
      )}
    </div>
  );
}

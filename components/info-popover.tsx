"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small "i" next to a label that opens a short guide. Click to open, click away or Escape to close. */
export function InfoPopover({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span ref={ref} className={cn("relative inline-flex", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label} title={label}
        className={cn("rounded-full p-0.5 transition-colors", open ? "text-accent" : "text-faint hover:text-ink")}>
        <Info className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label={label}
            initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="card absolute left-1/2 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 p-3.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-muted shadow-2xl sm:left-0 sm:translate-x-0">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

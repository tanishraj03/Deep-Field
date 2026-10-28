"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, KeyRound } from "lucide-react";
import type { PublicModel } from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

function tagTone(tag: string): "accent" | "ember" | "rise" | "neutral" {
  if (tag === "Paid") return "ember";
  if (tag === "Free") return "neutral";
  if (/best|fastest|ultra/i.test(tag)) return "accent";
  return "rise";
}

/** Switch models. Every option says what it is best at and what it costs. */
export function ModelPicker({ models, value, onChange }: { models: PublicModel[]; value: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const groups = [
    { label: "Free", items: models.filter((m) => m.free) },
    { label: "Paid", items: models.filter((m) => !m.free) },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-pill px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:bg-hair/[0.05] hover:text-ink"
      >
        <span className="text-ink">{current?.label ?? "Choose a model"}</span>
        {current && <Badge tone={tagTone(current.tags[0])} className="hidden sm:inline-flex">{current.tags[0]}</Badge>}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="card absolute bottom-full left-0 z-50 mb-2 max-h-[70vh] w-[22rem] overflow-y-auto p-1.5 shadow-2xl"
            role="listbox"
          >
            {groups.map((g) => g.items.length > 0 && (
              <div key={g.label}>
                <p className="eyebrow px-2.5 pb-1 pt-2">{g.label}</p>
                {g.items.map((m) => (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={m.id === value}
                    disabled={!m.available}
                    onClick={() => { onChange(m.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                      m.available ? "hover:bg-hair/[0.05]" : "cursor-default",
                      m.id === value && "bg-hair/[0.06]",
                    )}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {m.id === value && <Check className="h-3.5 w-3.5 text-accent" />}
                    </span>
                    <span className={cn("min-w-0 flex-1", !m.available && "opacity-55")}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[0.8125rem] font-semibold">{m.label}</span>
                        {m.tags.map((t) => <Badge key={t} tone={tagTone(t)}>{t}</Badge>)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{m.bestFor}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-faint">{m.providerName} · {m.pricing}</span>
                    </span>
                    {!m.available && (
                      <Link
                        href="/keys"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 flex shrink-0 items-center gap-1 rounded-pill bg-hair/[0.06] px-2 py-0.5 text-[0.6875rem] font-medium text-muted hover:text-ink"
                        title={`Add your ${m.providerName} key in Keys`}
                      >
                        <KeyRound className="h-3 w-3" />Add key
                      </Link>
                    )}
                  </button>
                ))}
              </div>
            ))}
            <p className="px-2.5 pb-1.5 pt-2 text-[0.6875rem] leading-relaxed text-faint">
              Models run on your own keys, kept encrypted on the server. Add or change them in <Link href="/keys" className="underline underline-offset-2 hover:text-ink">Keys</Link>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

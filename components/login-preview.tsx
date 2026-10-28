"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Zap } from "lucide-react";
import { compact } from "@/lib/utils";

export interface PreviewTopic {
  id: string;
  title: string;
  niche: string;
  heat: number;
  virality: number;
  comments: number;
  communities: number;
  call: "make" | "test" | "skip" | null;
  india: number;
}

const CALL = {
  make: { label: "Make now", cls: "bg-rise/15 text-rise" },
  test: { label: "Worth testing", cls: "bg-ember/15 text-ember" },
  skip: { label: "Skip", cls: "bg-hair/10 text-muted" },
} as const;

/** Where each floating card sits, and how it bobs. */
const SLOTS = [
  { className: "left-[4%] top-[8%] w-[19rem] rotate-[-3deg]", delay: 0 },
  { className: "right-[2%] top-[30%] w-[20rem] rotate-[2deg]", delay: 1.2 },
  { className: "left-[12%] bottom-[10%] w-[18rem] rotate-[1deg]", delay: 2.4 },
];

function Card({ t }: { t: PreviewTopic }) {
  const hot = t.heat >= 70;
  return (
    <div className="card p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[0.6875rem] text-muted">{t.niche}</span>
        <span className={`num text-lg font-semibold leading-none ${hot ? "text-ember" : ""}`}>{t.heat}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-[0.9375rem] font-semibold leading-snug tracking-tight">{t.title}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Zap className={`h-3.5 w-3.5 ${t.virality >= 70 ? "text-ember" : "text-faint"}`} /><span className="num">{t.virality}</span></span>
        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-faint" /><span className="num">{compact(t.comments)}</span></span>
        <span className="num">{t.communities} communities</span>
        {t.call && <span className={`rounded-pill px-2 py-0.5 text-[0.625rem] font-semibold ${CALL[t.call].cls}`}>{CALL[t.call].label}</span>}
      </div>
      <div className="mt-3 flex h-1 gap-px overflow-hidden rounded-pill">
        <span style={{ width: `${t.india}%`, background: "rgb(var(--india))" }} />
        <span className="flex-1" style={{ background: "rgb(var(--global))" }} />
      </div>
    </div>
  );
}

/**
 * The sign-in screen's right half: three of today's real conversations
 * floating over the radar, swapping one at a time so it feels live.
 */
export function LoginPreview({ topics }: { topics: PreviewTopic[] }) {
  const [shown, setShown] = useState(() => topics.slice(0, SLOTS.length).map((_, i) => i));
  useEffect(() => {
    if (topics.length <= SLOTS.length) return;
    let next = SLOTS.length;
    let slot = 0;
    const t = setInterval(() => {
      setShown((s) => s.map((v, i) => (i === slot ? next % topics.length : v)));
      next++;
      slot = (slot + 1) % SLOTS.length;
    }, 3200);
    return () => clearInterval(t);
  }, [topics.length]);

  if (!topics.length) return null;
  return (
    <div className="relative h-full w-full">
      {SLOTS.map((slot, i) => {
        const t = topics[shown[i]];
        if (!t) return null;
        return (
          <motion.div key={i} className={`absolute ${slot.className}`}
            animate={{ y: [0, -10, 0] }} transition={{ duration: 6, delay: slot.delay, repeat: Infinity, ease: "easeInOut" }}>
            <AnimatePresence mode="wait">
              <motion.div key={t.id}
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}>
                <Card t={t} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

/** A slow, endless strip of what's trending, for phones and the bottom of the screen. */
export function TopicTicker({ topics }: { topics: PreviewTopic[] }) {
  if (!topics.length) return null;
  const row = [...topics, ...topics];
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
      <motion.div className="flex w-max gap-2" animate={{ x: ["0%", "-50%"] }} transition={{ duration: topics.length * 4, repeat: Infinity, ease: "linear" }}>
        {row.map((t, i) => (
          <span key={`${t.id}-${i}`} className="card flex shrink-0 items-center gap-2 rounded-pill px-3 py-1.5 text-xs">
            <span className={`num font-semibold ${t.heat >= 70 ? "text-ember" : "text-ink"}`}>{t.heat}</span>
            <span className="max-w-[16rem] truncate text-muted">{t.title}</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Eyebrow, Glass, Tag } from "./ui";
import {
  INDUSTRY_OPTIONS, PLATFORM_OPTIONS, REGION_OPTIONS,
  defaultPrefs, loadPrefs, savePrefs, type Prefs,
} from "@/lib/prefs";
import type { Category, Platform, Region } from "@/lib/types";
import { cn } from "@/lib/utils";

type StepId = "regions" | "platforms" | "industries" | "slack";

const STEPS: { id: StepId; title: string; caption: string }[] = [
  {
    id: "regions",
    title: "Where should we look?",
    caption: "Each region maps to specific free feeds. Picking fewer means fewer sources checked, not shallower coverage.",
  },
  {
    id: "platforms",
    title: "Which platforms matter?",
    caption: "Signals are read from public feeds and public APIs only. Select nothing to keep everything.",
  },
  {
    id: "industries",
    title: "Which industries do you sell into?",
    caption: "This filters the feed, not the collection — everything is still gathered and scored. Select nothing to keep everything.",
  },
  {
    id: "slack",
    title: "Where should the brief land?",
    caption: "One free incoming webhook, posted to at 8:00 AM IST. No automation platform involved.",
  },
];

function Chip({ active, onClick, children, hint }: {
  active: boolean; onClick: () => void; children: React.ReactNode; hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press rounded-tile px-4 py-3 text-left transition-colors",
        active
          ? "bg-[rgb(var(--accent)/0.11)] text-[rgb(var(--accent))]"
          : "bg-[rgb(var(--hair)/0.05)] text-muted hover:text-ink",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
            active
              ? "border-transparent bg-[rgb(var(--accent))]"
              : "border-[rgb(var(--hair)/0.25)]",
          )}
          aria-hidden
        >
          {active && <Check className="h-3 w-3 text-canvas" strokeWidth={3} />}
        </span>
        <span className="text-[0.875rem] font-medium">{children}</span>
      </span>
      {hint && <span className="mt-1 block pl-6 text-[0.75rem] leading-snug text-faint">{hint}</span>}
    </button>
  );
}

export function Welcome() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // Starts from defaults so the first paint is the real thing, then adopts any
  // stored feed — re-running setup from Settings shows what you already chose.
  useEffect(() => setPrefs(loadPrefs()), []);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  function finish() {
    setFinishing(true);
    savePrefs({ ...prefs, completedAt: new Date().toISOString() });
    router.push("/");
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const canAdvance = current.id !== "regions" || prefs.regions.length > 0;

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-2xl flex-col justify-center py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      >
        <Eyebrow>Setup · {step + 1} of {STEPS.length}</Eyebrow>
        <h1 className="mt-1.5 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.5rem]">
          Build your intelligence feed
        </h1>

        {/* Progress — four segments, filling like a Control Centre control. */}
        <div className="mt-5 flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className="h-1 flex-1 overflow-hidden rounded-pill"
              style={{ background: "rgb(var(--hair) / 0.09)" }}
            >
              <motion.span
                className="block h-full rounded-pill"
                style={{ background: "rgb(var(--accent))" }}
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              />
            </div>
          ))}
        </div>
      </motion.div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          >
            <Glass className="p-5 sm:p-7">
              <h2 className="text-[1.25rem] font-semibold tracking-[-0.018em]">{current.title}</h2>
              <p className="mt-1.5 text-[0.875rem] leading-[1.6] text-muted">{current.caption}</p>

              <div className="mt-5">
                {current.id === "regions" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {REGION_OPTIONS.map((o) => (
                      <Chip
                        key={o.id}
                        active={prefs.regions.includes(o.id)}
                        hint={o.hint}
                        onClick={() =>
                          setPrefs((p) => ({ ...p, regions: toggle<Region>(p.regions, o.id) }))
                        }
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                )}

                {current.id === "platforms" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PLATFORM_OPTIONS.map((o) => (
                      <Chip
                        key={o.id}
                        active={prefs.platforms.includes(o.id)}
                        onClick={() =>
                          setPrefs((p) => ({ ...p, platforms: toggle<Platform>(p.platforms, o.id) }))
                        }
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                )}

                {current.id === "industries" && (
                  <div className="flex flex-wrap gap-1.5">
                    {INDUSTRY_OPTIONS.map((c) => {
                      const active = prefs.industries.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() =>
                            setPrefs((p) => ({ ...p, industries: toggle<Category>(p.industries, c) }))
                          }
                          aria-pressed={active}
                          className={cn(
                            "press rounded-pill px-3.5 py-2 text-[0.8125rem] font-medium transition-colors",
                            active
                              ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]"
                              : "bg-[rgb(var(--hair)/0.05)] text-muted hover:text-ink",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}

                {current.id === "slack" && (
                  <div className="space-y-4">
                    <Chip
                      active={prefs.slackIntent}
                      hint="You'll paste the webhook URL into SLACK_WEBHOOK_URL. Settings has a test button."
                      onClick={() => setPrefs((p) => ({ ...p, slackIntent: !p.slackIntent }))}
                    >
                      Send the daily brief to Slack
                    </Chip>

                    <div
                      className="rounded-tile px-4 py-3"
                      style={{ background: "rgb(var(--hair) / 0.045)" }}
                    >
                      <Eyebrow className="mb-1.5">Your feed</Eyebrow>
                      <div className="flex flex-wrap gap-1.5">
                        <Tag tone="accent">
                          {prefs.regions.length || "All"} region{prefs.regions.length === 1 ? "" : "s"}
                        </Tag>
                        <Tag>{prefs.platforms.length || "All"} platforms</Tag>
                        <Tag>{prefs.industries.length || "All"} industries</Tag>
                      </div>
                      <p className="readout mt-2.5 text-[0.7rem] leading-relaxed text-faint">
                        Stored in this browser only. Nothing is sent anywhere, and every
                        choice is reversible from Settings.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Glass>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="press inline-flex items-center gap-1.5 rounded-pill bg-[rgb(var(--hair)/0.06)] px-4 py-2.5 text-[0.8125rem] font-semibold text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}

        <button
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
          disabled={!canAdvance || finishing}
          className="press inline-flex items-center gap-1.5 rounded-pill px-5 py-2.5 text-[0.8125rem] font-semibold transition-opacity disabled:opacity-40"
          style={{ background: "rgb(var(--accent))", color: "rgb(var(--canvas))" }}
        >
          {finishing ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Starting</>
          ) : isLast ? (
            <>Start monitoring <ArrowRight className="h-3.5 w-3.5" /></>
          ) : (
            <>Continue <ArrowRight className="h-3.5 w-3.5" /></>
          )}
        </button>

        <button
          onClick={finish}
          className="press ml-auto text-[0.8125rem] text-faint transition-colors hover:text-muted"
        >
          Skip — show me everything
        </button>
      </div>

      <p className="readout mt-6 text-center text-[0.7rem] leading-relaxed text-faint">
        No account, no card, no paid service. The app runs on free tiers and reduces
        coverage rather than billing you when a quota runs out.
      </p>
    </div>
  );
}

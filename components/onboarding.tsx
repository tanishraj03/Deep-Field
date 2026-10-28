"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, AtSign, Check, KeyRound, Loader2, X } from "lucide-react";
import { QUESTIONS, type FeedPrefs, type Question } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

type Availability = { state: "idle" | "checking" | "ok" | "bad"; message?: string };

/**
 * Step 0 picks a username. Steps 1–5 are the feed questions, each skippable;
 * answers are saved as you go, so leaving halfway keeps what you answered.
 * The last screen points at Keys, since nothing AI runs without one.
 */
export function Onboarding({ firstName, suggested, initialPrefs, editing }: {
  firstName: string; suggested: string; initialPrefs: FeedPrefs; editing: boolean;
}) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(suggested);
  const [avail, setAvail] = useState<Availability>({ state: "idle" });
  const [prefs, setPrefs] = useState<FeedPrefs>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = QUESTIONS.length;
  const done = step > total;

  // Check the username as it is typed, after a short pause.
  useEffect(() => {
    if (step !== 0) return;
    const name = username.trim();
    if (!name) { setAvail({ state: "idle" }); return; }
    setAvail({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/profile?username=${encodeURIComponent(name)}`);
        const json = await res.json();
        setAvail(json.available ? { state: "ok" } : { state: "bad", message: json.error ?? "Not available." });
      } catch {
        setAvail({ state: "idle" });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, step]);

  const put = async (body: object) => {
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Couldn't save. Try again.");
  };

  const saveUsername = async () => {
    setSaving(true); setError(null);
    try { await put({ username }); setStep(1); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const answer = async (q: Question, value: string[] | string | null, skip = false) => {
    const next = { ...prefs, [q.id]: skip ? (q.multi ? [] : null) : value } as FeedPrefs;
    setPrefs(next);
    setSaving(true); setError(null);
    try {
      await put({ prefs: next });
      // Open the feed on the chosen audience, even if this browser had another remembered.
      if (q.id === "region") try { next.region ? localStorage.setItem("df-region", next.region) : localStorage.removeItem("df-region"); } catch {}
      setStep((s) => s + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // A full load, so the navigation and feed pick up the new account and answers.
  const finish = (href: string) => window.location.assign(href);

  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-[34rem]">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-label={done ? "Done" : `Step ${step + 1} of ${total + 1}`}>
            {Array.from({ length: total + 1 }, (_, i) => (
              <span key={i} className={cn("h-1 rounded-pill transition-all", i === step ? "w-6 bg-ink" : i < step ? "w-3 bg-ink/40" : "w-3 bg-hair/15")} />
            ))}
          </div>
          {editing && !done && <Link href="/" className="flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="h-3.5 w-3.5" />Close</Link>}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {step === 0 && (
              <section>
                <p className="eyebrow">{editing ? "Your account" : `Welcome, ${firstName}`}</p>
                <h1 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-tight">Pick a username</h1>
                <p className="mt-1.5 text-sm text-muted">This is how you show up in DeepField. You can change it later.</p>
                <form className="mt-6" onSubmit={(e) => { e.preventDefault(); if (avail.state !== "bad") saveUsername(); }}>
                  <label className="relative block">
                    <span className="sr-only">Username</span>
                    <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
                      autoFocus autoComplete="username" spellCheck={false} maxLength={20}
                      className="h-12 w-full rounded-2xl bg-surface pl-10 pr-10 text-[0.95rem] outline-none ring-1 ring-hair/15 transition focus:ring-2 focus:ring-accent/50"
                      aria-invalid={avail.state === "bad"} aria-describedby="username-status"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {avail.state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-faint" />}
                      {avail.state === "ok" && <Check className="h-4 w-4 text-rise" />}
                      {avail.state === "bad" && <X className="h-4 w-4 text-fall" />}
                    </span>
                  </label>
                  <p id="username-status" className={cn("mt-2 min-h-[1rem] text-xs", avail.state === "bad" ? "text-fall" : "text-faint")}>
                    {avail.state === "bad" ? avail.message : avail.state === "ok" ? "Available." : "Lowercase letters, numbers and underscores."}
                  </p>
                  {error && <p className="mt-1 text-xs text-fall" role="alert">{error}</p>}
                  <div className="mt-6 flex justify-end">
                    <Button variant="primary" type="submit" loading={saving} disabled={!username.trim() || avail.state === "bad"}>
                      Continue<ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </form>
              </section>
            )}

            {step >= 1 && !done && (
              <QuestionStep
                key={QUESTIONS[step - 1].id}
                q={QUESTIONS[step - 1]} index={step} total={total}
                initial={prefs[QUESTIONS[step - 1].id]}
                saving={saving} error={error}
                onBack={() => { setError(null); setStep((s) => s - 1); }}
                onAnswer={(v) => answer(QUESTIONS[step - 1], v)}
                onSkip={() => answer(QUESTIONS[step - 1], null, true)}
              />
            )}

            {done && (
              <section>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rise/10"><Check className="h-5 w-5 text-rise" /></span>
                <h1 className="mt-4 text-[1.6rem] font-semibold leading-tight tracking-tight">{editing ? "Saved" : `You're in, @${username.trim()}`}</h1>
                <p className="mt-1.5 text-sm text-muted">
                  Your feed is tailored to your answers. Change them any time from your account menu under Feed preferences.
                </p>
                <div className="card mt-6 flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10"><KeyRound className="h-4 w-4 text-accent" /></span>
                  <div className="text-sm">
                    <p className="font-medium">Add your keys to unlock the AI</p>
                    <p className="mt-0.5 text-muted">
                      DeepField runs on your own keys, so nobody spends anyone else&apos;s credits. A free Gemini key takes a minute and unlocks the assistant, AI insights and rescans.
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" onClick={() => finish("/")}>Go to my feed</Button>
                  <Button variant="primary" onClick={() => finish("/keys")}><KeyRound className="h-3.5 w-3.5" />Add keys</Button>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuestionStep({ q, index, total, initial, saving, error, onBack, onAnswer, onSkip }: {
  q: Question; index: number; total: number; initial: FeedPrefs[keyof FeedPrefs];
  saving: boolean; error: string | null;
  onBack: () => void; onAnswer: (v: string[] | string | null) => void; onSkip: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(Array.isArray(initial) ? initial : initial ? [initial] : []);
  const toggle = (v: string) => setPicked((p) => (q.multi ? (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]) : [v]));
  const hasSubs = q.options.some((o) => o.sub);

  return (
    <section>
      <p className="eyebrow">Question {index} of {total}</p>
      <h1 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-tight">{q.title}</h1>
      <p className="mt-1.5 text-sm text-muted">{q.hint}</p>

      <div className={cn("mt-6", hasSubs ? "grid gap-2" : "flex flex-wrap gap-2")} role={q.multi ? "group" : "radiogroup"} aria-label={q.title}>
        {q.options.map((o) => {
          const on = picked.includes(o.value);
          return (
            <button key={o.value} type="button" onClick={() => toggle(o.value)}
              role={q.multi ? "checkbox" : "radio"} aria-checked={on}
              className={cn(
                "press text-left transition-colors",
                hasSubs ? "card flex items-start gap-3 p-3.5" : "rounded-pill px-3.5 py-2 text-[0.8125rem] font-medium",
                hasSubs
                  ? on ? "border-accent/50 ring-1 ring-accent/40" : "hover:border-hair/20"
                  : on ? "bg-ink text-canvas" : "bg-hair/[0.05] text-muted hover:text-ink",
              )}>
              {hasSubs && (
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1", on ? "bg-accent ring-accent" : "ring-hair/25")}>
                  {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
              )}
              <span>
                <span className={cn(hasSubs && "block text-[0.875rem] font-medium")}>{!hasSubs && on && <Check className="-ml-0.5 mr-1 inline h-3.5 w-3.5" />}{o.label}</span>
                {o.sub && <span className="mt-0.5 block text-xs text-muted">{o.sub}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs text-fall" role="alert">{error}</p>}
      <div className="mt-8 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack} disabled={saving}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip} disabled={saving}>Skip</Button>
          <Button variant="primary" loading={saving} disabled={!picked.length}
            onClick={() => onAnswer(q.multi ? picked : picked[0])}>
            {index === total ? "Finish" : "Continue"}<ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

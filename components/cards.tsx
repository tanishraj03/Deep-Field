"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Bookmark, ChevronRight } from "lucide-react";
import { Capsule, Glass, Eyebrow, Tag, riseIn } from "./ui";
import { cn, relativeTime, truncate } from "@/lib/utils";
import { companyOf, companySlug } from "@/lib/company";
import type { IntelligenceItem, ScoreBreakdown } from "@/lib/types";

const REGION_LABEL: Record<string, string> = {
  IN: "India", US: "United States", EU: "Europe",
  SEA: "Southeast Asia", ME: "Middle East", GLOBAL: "Global",
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X",
  linkedin: "LinkedIn", reddit: "Reddit", threads: "Threads",
  facebook: "Facebook", "google-trends": "Google Trends", web: "Web",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <Eyebrow className="mb-1">{label}</Eyebrow>
      <p className="text-[0.875rem] leading-[1.6] text-ink/85">{children}</p>
    </div>
  );
}

function Breakdown({ parts, total }: { parts: ScoreBreakdown[]; total: number }) {
  return (
    <div className="space-y-2">
      {parts.map((p) => (
        <div key={p.label} className="flex items-baseline gap-3">
          <span className="readout w-11 shrink-0 text-[0.8125rem] font-semibold">
            {p.value}<span className="text-faint">/{p.weight}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-medium leading-tight">{p.label}</p>
            <p className="text-[0.75rem] leading-snug text-faint">{p.note}</p>
          </div>
          <div className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-pill sm:block"
               style={{ background: "rgb(var(--hair) / 0.08)" }}>
            <span className="block h-full rounded-pill"
                  style={{ width: `${(p.value / p.weight) * 100}%`, background: "rgb(var(--accent) / 0.75)" }} />
          </div>
        </div>
      ))}
      <p className="readout hairline pt-2 text-[0.8125rem] font-semibold">
        Total {total}<span className="text-faint"> / 100</span>
      </p>
    </div>
  );
}

function Sources({ item }: { item: IntelligenceItem }) {
  return (
    <div>
      <Eyebrow className="mb-1.5">
        Sources · {item.sources.length}
        {item.duplicatesMerged > 0 && ` · ${item.duplicatesMerged} duplicate report${item.duplicatesMerged === 1 ? "" : "s"} merged`}
      </Eyebrow>
      <ul className="space-y-1">
        {item.sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-baseline gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-ink"
            >
              <span className="underline decoration-[rgb(var(--hair)/0.25)] underline-offset-[3px]">{s.name}</span>
              <span className="readout text-[0.7rem] text-faint">{relativeTime(s.publishedAt)}</span>
              <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveButton({ id, saved, onToggle }: { id: string; saved: boolean; onToggle: (id: string) => void }) {
  return (
    <button
      onClick={() => onToggle(id)}
      aria-pressed={saved}
      className={cn(
        "press inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[0.75rem] font-semibold transition-colors",
        saved
          ? "text-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.12)]"
          : "text-muted hover:text-ink bg-[rgb(var(--hair)/0.06)]",
      )}
    >
      <Bookmark className="h-3.5 w-3.5" strokeWidth={2} fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved" : "Save"}
    </button>
  );
}

/** Links into the profile we hold, rather than out to one publisher's page. */
function CompanyLink({ item }: { item: IntelligenceItem }) {
  const name = companyOf(item);
  if (!name) return null;
  return (
    <Link
      href={`/company/${companySlug(name)}`}
      className="press inline-flex items-center gap-1.5 rounded-pill bg-[rgb(var(--hair)/0.06)] px-3 py-1.5 text-[0.75rem] font-semibold text-muted transition-colors hover:text-ink"
    >
      Company profile <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function SourceLink({ item }: { item: IntelligenceItem }) {
  return (
    <a
      href={item.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="press inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[0.75rem] font-semibold text-faint transition-colors hover:text-ink"
    >
      Primary source <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

function Expander({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
      >
        {label}
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-300", open && "rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Header({ item }: { item: IntelligenceItem }) {
  const breakout = item.trendLabel === "BREAKOUT";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag tone={breakout ? "ember" : "neutral"}>{item.signalLabel}</Tag>
      {item.isNew && <Tag tone="accent">New</Tag>}
      {item.isUpdate && <Tag tone="accent">Update</Tag>}
      <span className="readout text-[0.7rem] text-faint">
        {PLATFORM_LABEL[item.platform] ?? item.platform} · {REGION_LABEL[item.region] ?? item.region}
      </span>
      <span className="readout ml-auto text-[0.7rem] text-faint">{relativeTime(item.publishedAt)}</span>
    </div>
  );
}

const LABEL_TONE = (l?: string) => (l === "BREAKOUT" ? "ember" : "accent") as "ember" | "accent";
const LABEL_TEXT = (l?: string) =>
  l === "BREAKOUT" ? "🔥 Breakout" : l === "RISING" ? "🚀 Rising" : l === "WATCH" ? "👀 Watch" : "Low signal";

// ── Trend ─────────────────────────────────────────────────────────────────────

export function TrendCard({ item, saved, onToggle }: {
  item: IntelligenceItem; saved: boolean; onToggle: (id: string) => void;
}) {
  const a = item.analysis;
  return (
    <motion.article variants={riseIn}>
      <Glass className="p-5 sm:p-6">
        <Header item={item} />
        <h3 className="mt-3 text-[1.0625rem] font-semibold leading-snug tracking-[-0.011em] sm:text-[1.125rem]">
          {item.title}
        </h3>

        <div className="mt-5 max-w-sm">
          <Capsule
            value={item.trendScore ?? 0}
            tone={LABEL_TONE(item.trendLabel)}
            label={LABEL_TEXT(item.trendLabel)}
            threshold={90}
            estimated={item.scoreIsEstimated}
          />
        </div>

        <div className="mt-5 space-y-4">
          <Field label="What happened">{a?.whatHappened || item.summary}</Field>
          <Field label="Why it's moving">{a?.whyItsMoving}</Field>
          <Field label="Creator opportunity">{a?.creatorOpportunity}</Field>
          <Field label="Brand opportunity">{a?.brandOpportunity}</Field>
        </div>

        <div className="hairline mt-5 space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="outline">Confidence {item.confidenceLabel}</Tag>
            {a && <Tag tone="outline">{a.generatedBy === "gemini" ? "AI interpretation" : "Rules only"}</Tag>}
            {item.categories.slice(0, 3).map((c) => <Tag key={c}>{c}</Tag>)}
          </div>
          {item.trendBreakdown && (
            <Expander label={`Why ${item.trendScore}?`}>
              <Breakdown parts={item.trendBreakdown} total={item.trendScore ?? 0} />
            </Expander>
          )}
          <Sources item={item} />
          <SaveButton id={item.id} saved={saved} onToggle={onToggle} />
        </div>
      </Glass>
    </motion.article>
  );
}

// ── Funding ───────────────────────────────────────────────────────────────────

export function FundingCard({ item, saved, onToggle }: {
  item: IntelligenceItem; saved: boolean; onToggle: (id: string) => void;
}) {
  const f = item.funding;
  const a = item.analysis;
  return (
    <motion.article variants={riseIn}>
      <Glass className="p-5 sm:p-6">
        <Header item={item} />

        <h3 className="mt-3 text-[1.25rem] font-semibold leading-tight tracking-[-0.018em]">
          {f?.companyName ?? truncate(item.title, 60)}
        </h3>
        <p className="readout mt-1 text-[0.75rem] text-faint">
          {item.categories[0] ?? "Unclassified"} · {REGION_LABEL[item.region] ?? item.region}
        </p>

        <p className="readout mt-4 text-[1.75rem] font-semibold leading-none tracking-tight">
          {f?.amountDisclosed ? `Raised ${f.amountRaw}` : "Amount not publicly disclosed"}
        </p>
        <p className="readout mt-1.5 text-[0.8125rem] text-muted">
          {f?.round ?? "Round not disclosed"} · {relativeTime(f?.announcedAt ?? item.publishedAt)}
        </p>

        <div className="mt-4">
          <Eyebrow className="mb-1.5">Investors</Eyebrow>
          {f?.investors.length ? (
            <div className="flex flex-wrap gap-1.5">
              {f.investors.map((inv) => <Tag key={inv}>{inv}</Tag>)}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-faint">Not publicly disclosed</p>
          )}
        </div>

        <div className="mt-5 space-y-4">
          <Field label="What they do">{a?.whatHappened || item.summary}</Field>
          <Field label="Why we care">{a?.whyWeCare}</Field>
        </div>

        {typeof item.opportunityScore === "number" && (
          <div className="mt-5 max-w-sm">
            <Eyebrow className="mb-1.5">Collab potential</Eyebrow>
            <Capsule value={item.opportunityScore} label="Opportunity" threshold={85} />
          </div>
        )}

        {item.creatorCategories?.length ? (
          <div className="mt-4">
            <Eyebrow className="mb-1.5">Best creator categories</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {item.creatorCategories.map((c) => <Tag key={c} tone="accent">{c}</Tag>)}
            </div>
          </div>
        ) : null}

        <div className="hairline mt-5 space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="outline">Confidence {item.confidenceLabel}</Tag>
            {a && <Tag tone="outline">{a.generatedBy === "gemini" ? "AI interpretation" : "Rules only"}</Tag>}
          </div>
          {item.opportunityBreakdown && (
            <Expander label={`Why ${item.opportunityScore}?`}>
              <Breakdown parts={item.opportunityBreakdown} total={item.opportunityScore ?? 0} />
            </Expander>
          )}
          <Sources item={item} />
          <div className="flex flex-wrap gap-2">
            <CompanyLink item={item} />
            <SourceLink item={item} />
            <SaveButton id={item.id} saved={saved} onToggle={onToggle} />
          </div>
        </div>
      </Glass>
    </motion.article>
  );
}

// ── Marketing ─────────────────────────────────────────────────────────────────

export function MarketingCard({ item, saved, onToggle }: {
  item: IntelligenceItem; saved: boolean; onToggle: (id: string) => void;
}) {
  const m = item.marketing;
  const a = item.analysis;
  return (
    <motion.article variants={riseIn}>
      <Glass className="p-5 sm:p-6">
        <Header item={item} />

        <h3 className="mt-3 text-[1.25rem] font-semibold leading-tight tracking-[-0.018em]">
          {m?.companyName ?? truncate(item.title, 60)}
        </h3>
        <p className="readout mt-1 text-[0.75rem] text-faint">
          {item.categories[0] ?? "Consumer"} · {REGION_LABEL[item.region] ?? item.region}
        </p>

        <p className="mt-4 text-[1.0625rem] font-semibold tracking-tight">
          Marketing activity{" "}
          <span style={{ color: "rgb(var(--accent))" }}>↑ {m?.activityLevel ?? "NOTABLE"}</span>
        </p>
        <p className="readout mt-1 text-[0.7rem] text-faint">
          {m?.spendReported
            ? `Reported spend ${m.spendReported.amountRaw} — figure taken from the source, not estimated`
            : "Spend figure not publicly disclosed. Level inferred from observable signals only."}
        </p>

        <div className="mt-5 space-y-4">
          <Field label="What we're seeing">{a?.whatHappened || item.summary}</Field>
          <Field label="Why now">{a?.whyItsMoving}</Field>
        </div>

        {m?.signals.length ? (
          <div className="mt-4">
            <Eyebrow className="mb-1.5">Signals observed</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {m.signals.map((s) => <Tag key={s}>{s}</Tag>)}
            </div>
          </div>
        ) : null}

        {typeof item.opportunityScore === "number" && (
          <div className="mt-5 max-w-sm">
            <Eyebrow className="mb-1.5">Collab potential</Eyebrow>
            <Capsule value={item.opportunityScore} label="Opportunity" threshold={85} />
          </div>
        )}

        {item.creatorCategories?.length ? (
          <div className="mt-4">
            <Eyebrow className="mb-1.5">Best creator categories</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {item.creatorCategories.map((c) => <Tag key={c} tone="accent">{c}</Tag>)}
            </div>
          </div>
        ) : null}

        {a?.creatorOpportunity ? (
          <div className="mt-4">
            <Field label="Possible pitch">{a.creatorOpportunity}</Field>
          </div>
        ) : null}

        <div className="hairline mt-5 space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="outline">Confidence {item.confidenceLabel}</Tag>
            {a && <Tag tone="outline">{a.generatedBy === "gemini" ? "AI interpretation" : "Rules only"}</Tag>}
          </div>
          {item.opportunityBreakdown && (
            <Expander label={`Why ${item.opportunityScore}?`}>
              <Breakdown parts={item.opportunityBreakdown} total={item.opportunityScore ?? 0} />
            </Expander>
          )}
          <Sources item={item} />
          <div className="flex flex-wrap gap-2">
            <CompanyLink item={item} />
            <SaveButton id={item.id} saved={saved} onToggle={onToggle} />
          </div>
        </div>
      </Glass>
    </motion.article>
  );
}

// ── Opportunity ───────────────────────────────────────────────────────────────

export function OpportunityCard({ item, saved, onToggle }: {
  item: IntelligenceItem; saved: boolean; onToggle: (id: string) => void;
}) {
  const name = item.funding?.companyName ?? item.marketing?.companyName ?? truncate(item.title, 50);
  const reasons = (item.opportunityBreakdown ?? [])
    .filter((b) => b.value / b.weight >= 0.6)
    .map((b) => `${b.label} — ${b.note}`);

  return (
    <motion.article variants={riseIn}>
      <Glass className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.018em]">{name}</h3>
            <p className="readout mt-1 text-[0.75rem] text-faint">
              {item.categories.slice(0, 2).join(" · ") || "Unclassified"} · {REGION_LABEL[item.region] ?? item.region}
            </p>
          </div>
          <div className="w-full max-w-[15rem]">
            <Capsule value={item.opportunityScore ?? 0} label="Opportunity" threshold={85} />
          </div>
        </div>

        <div className="mt-5">
          <Eyebrow className="mb-2">Why</Eyebrow>
          <ul className="space-y-1.5">
            {(reasons.length ? reasons : ["Scored on deterministic signals only"]).map((r) => (
              <li key={r} className="flex gap-2 text-[0.8125rem] leading-snug text-ink/85">
                <span style={{ color: "rgb(var(--accent))" }} aria-hidden>✓</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {item.pitchIdeas?.length ? (
          <div className="mt-5">
            <Eyebrow className="mb-2">What we could pitch</Eyebrow>
            <ul className="space-y-2">
              {item.pitchIdeas.map((p) => (
                <li key={p} className="rounded-tile px-3 py-2 text-[0.8125rem] leading-snug"
                    style={{ background: "rgb(var(--hair) / 0.045)" }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {item.creatorCategories?.length ? (
            <div>
              <Eyebrow className="mb-1.5">Ideal creator types</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {item.creatorCategories.map((c) => <Tag key={c} tone="accent">{c}</Tag>)}
              </div>
            </div>
          ) : null}
          {item.contactRoles?.length ? (
            <div>
              <Eyebrow className="mb-1.5">Who to contact</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {item.contactRoles.map((c) => <Tag key={c}>{c}</Tag>)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hairline mt-5 space-y-4 pt-4">
          {item.opportunityBreakdown && (
            <Expander label={`Why ${item.opportunityScore}?`}>
              <Breakdown parts={item.opportunityBreakdown} total={item.opportunityScore ?? 0} />
            </Expander>
          )}
          <Sources item={item} />
          <div className="flex flex-wrap gap-2">
            <SaveButton id={item.id} saved={saved} onToggle={onToggle} />
            <CompanyLink item={item} />
            <SourceLink item={item} />
          </div>
        </div>
      </Glass>
    </motion.article>
  );
}

export function AutoCard(props: { item: IntelligenceItem; saved: boolean; onToggle: (id: string) => void }) {
  if (props.item.type === "funding") return <FundingCard {...props} />;
  if (props.item.type === "marketing") return <MarketingCard {...props} />;
  return <TrendCard {...props} />;
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Bookmark, Info } from "lucide-react";
import { Capsule, Eyebrow, Glass, Tag, riseIn, stagger } from "./ui";
import { useSaved } from "./saved";
import { OUTREACH_LABEL, useOutreach, type OutreachStatus } from "./outreach";
import type { CompanyProfile, TimelineEntry } from "@/lib/company";
import { cn, relativeTime } from "@/lib/utils";

const REGION_LABEL: Record<string, string> = {
  IN: "India", US: "United States", EU: "Europe",
  SEA: "Southeast Asia", ME: "Middle East", GLOBAL: "Global",
};

const KIND_COLOR: Record<TimelineEntry["kind"], string> = {
  funding: "rgb(var(--accent))",
  marketing: "rgb(var(--accent))",
  trend: "rgb(var(--ember))",
  observed: "rgb(var(--hair) / 0.35)",
};

function Panel({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.section variants={riseIn}>
      <Glass className={cn("p-5 sm:p-6", className)}>
        <Eyebrow className="mb-3">{label}</Eyebrow>
        {children}
      </Glass>
    </motion.section>
  );
}

function Fact({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="hairline py-2.5 first:border-0 first:pt-0">
      <Eyebrow className="mb-0.5">{label}</Eyebrow>
      <p className={cn("readout text-[0.9375rem] font-medium", muted && "font-normal text-faint")}>
        {value}
      </p>
    </div>
  );
}

function OutreachPicker({ slug }: { slug: string }) {
  const { statusOf, set } = useOutreach();
  const current = statusOf(slug);
  const options: OutreachStatus[] = ["none", "researching", "contacted", "talking", "passed"];

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Outreach status">
      {options.map((o) => {
        const active = current === o;
        return (
          <button
            key={o}
            onClick={() => set(slug, o)}
            aria-pressed={active}
            className={cn(
              "press rounded-pill px-3 py-1.5 text-[0.75rem] font-semibold transition-colors",
              active
                ? "bg-[rgb(var(--accent)/0.13)] text-[rgb(var(--accent))]"
                : "bg-[rgb(var(--hair)/0.06)] text-muted hover:text-ink",
            )}
          >
            {OUTREACH_LABEL[o]}
          </button>
        );
      })}
    </div>
  );
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-4 pl-5">
      <span
        className="absolute inset-y-1 left-[3px] w-px"
        style={{ background: "rgb(var(--hair) / 0.14)" }}
        aria-hidden
      />
      {entries.map((e, idx) => (
        <li key={`${e.at}-${e.kind}-${idx}`} className="relative">
          <span
            className="absolute -left-5 top-[6px] h-[7px] w-[7px] rounded-full"
            style={{ background: KIND_COLOR[e.kind] }}
            aria-hidden
          />
          <p className="readout text-[0.7rem] uppercase tracking-[0.09em] text-faint">
            {relativeTime(e.at)} · {e.kind === "observed" ? "System" : e.kind}
          </p>
          <p className="mt-0.5 text-[0.875rem] font-medium leading-snug">{e.label}</p>
          {e.detail && <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{e.detail}</p>}
          {e.sourceUrl && e.sourceName && (
            <a
              href={e.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-1 inline-flex items-baseline gap-1 text-[0.75rem] text-faint transition-colors hover:text-ink"
            >
              <span className="underline decoration-[rgb(var(--hair)/0.25)] underline-offset-[3px]">
                {e.sourceName}
              </span>
              <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

export function CompanyView({ profile }: { profile: CompanyProfile }) {
  const { toggle, isSaved } = useSaved();
  const anchor = profile.items[0];
  const saved = isSaved(anchor.id);
  const f = profile.funding;
  const m = profile.marketing;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      <motion.header variants={riseIn}>
        <Link
          href="/opportunities"
          className="press inline-flex items-center gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Who we should talk to
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">
              {profile.name}
            </h1>
            <p className="readout mt-1.5 text-[0.75rem] text-faint">
              {profile.categories.slice(0, 3).join(" · ") || "Unclassified"} ·{" "}
              {REGION_LABEL[profile.region] ?? profile.region} · first seen{" "}
              {relativeTime(profile.firstSeenAt)}
            </p>
          </div>
          {typeof profile.opportunityScore === "number" && (
            <div className="w-full max-w-[17rem]">
              <Capsule
                value={profile.opportunityScore}
                label="Opportunity"
                threshold={85}
                estimated={profile.scoreIsEstimated}
              />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Tag tone="outline">Confidence {profile.confidenceLabel}</Tag>
          {profile.generatedBy && (
            <Tag tone="outline">
              {profile.generatedBy === "gemini" ? "AI interpretation" : "Rules only"}
            </Tag>
          )}
          <Tag>
            {profile.sources.length} source{profile.sources.length === 1 ? "" : "s"}
          </Tag>
          <button
            onClick={() => toggle(anchor.id)}
            aria-pressed={saved}
            className={cn(
              "press ml-auto inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[0.75rem] font-semibold transition-colors",
              saved
                ? "bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]"
                : "bg-[rgb(var(--hair)/0.06)] text-muted hover:text-ink",
            )}
          >
            <Bookmark className="h-3.5 w-3.5" strokeWidth={2} fill={saved ? "currentColor" : "none"} />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </motion.header>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {profile.whatTheyDo && (
            <Panel label="What they do">
              <p className="text-[0.9375rem] leading-[1.65] text-ink/85">{profile.whatTheyDo}</p>
              {profile.whyWeCare && (
                <>
                  <Eyebrow className="mb-1 mt-5">Why we care</Eyebrow>
                  <p className="text-[0.875rem] leading-[1.6] text-ink/85">{profile.whyWeCare}</p>
                </>
              )}
            </Panel>
          )}

          <Panel label="Funding">
            {f ? (
              <div>
                <p className="readout text-[1.75rem] font-semibold leading-none tracking-tight">
                  {f.amountDisclosed ? f.amountRaw : "Not publicly disclosed"}
                </p>
                <p className="readout mt-1.5 text-[0.8125rem] text-muted">
                  {f.round ?? "Round not disclosed"} · {relativeTime(f.announcedAt)}
                </p>
                <div className="mt-4">
                  <Eyebrow className="mb-1.5">Investors</Eyebrow>
                  {f.investors.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {f.investors.map((i) => <Tag key={i}>{i}</Tag>)}
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-faint">Not publicly disclosed</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[0.875rem] text-faint">
                No funding event on record for this company.
              </p>
            )}
          </Panel>

          <Panel label="Marketing activity">
            {m ? (
              <div>
                <p className="text-[1.0625rem] font-semibold tracking-tight">
                  Marketing activity{" "}
                  <span style={{ color: "rgb(var(--accent))" }}>↑ {m.activityLevel}</span>
                </p>
                <p className="readout mt-1 text-[0.7rem] leading-relaxed text-faint">
                  {m.spendReported
                    ? `Reported spend ${m.spendReported.amountRaw} — figure taken from the source, not estimated`
                    : "Spend figure not publicly disclosed. Level inferred from observable signals only."}
                </p>
                {m.signals.length > 0 && (
                  <div className="mt-4">
                    <Eyebrow className="mb-1.5">Signals observed</Eyebrow>
                    <div className="flex flex-wrap gap-1.5">
                      {m.signals.map((s) => <Tag key={s}>{s}</Tag>)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[0.875rem] text-faint">
                No marketing activity observed yet.
              </p>
            )}
          </Panel>

          {(profile.creatorCategories.length > 0 || profile.pitchIdeas.length > 0) && (
            <Panel label="Collaboration fit">
              {profile.creatorCategories.length > 0 && (
                <>
                  <Eyebrow className="mb-1.5">Ideal creator types</Eyebrow>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.creatorCategories.map((c) => (
                      <Tag key={c} tone="accent">{c}</Tag>
                    ))}
                  </div>
                </>
              )}
              {profile.pitchIdeas.length > 0 && (
                <>
                  <Eyebrow className="mb-2 mt-5">What we could pitch</Eyebrow>
                  <ul className="space-y-2">
                    {profile.pitchIdeas.map((p) => (
                      <li
                        key={p}
                        className="rounded-tile px-3 py-2 text-[0.8125rem] leading-snug"
                        style={{ background: "rgb(var(--hair) / 0.045)" }}
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {profile.creatorOpportunity && (
                <>
                  <Eyebrow className="mb-1 mt-5">Creator opportunity</Eyebrow>
                  <p className="text-[0.875rem] leading-[1.6] text-ink/85">
                    {profile.creatorOpportunity}
                  </p>
                </>
              )}
            </Panel>
          )}

          {profile.opportunityBreakdown && (
            <Panel label={`Why ${profile.opportunityScore}?`}>
              <div className="space-y-2">
                {profile.opportunityBreakdown.map((p) => (
                  <div key={p.label} className="flex items-baseline gap-3">
                    <span className="readout w-11 shrink-0 text-[0.8125rem] font-semibold">
                      {p.value}<span className="text-faint">/{p.weight}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium leading-tight">{p.label}</p>
                      <p className="text-[0.75rem] leading-snug text-faint">{p.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel label="Outreach">
            <OutreachPicker slug={profile.slug} />
            {profile.contactRoles.length > 0 && (
              <>
                <Eyebrow className="mb-1.5 mt-5">Who to contact</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {profile.contactRoles.map((c) => <Tag key={c}>{c}</Tag>)}
                </div>
                <p className="readout mt-2 text-[0.7rem] leading-relaxed text-faint">
                  Roles, not people. No contact details are collected.
                </p>
              </>
            )}
          </Panel>

          <Panel label="Record">
            <Fact label="First seen" value={relativeTime(profile.firstSeenAt)} />
            <Fact label="Last updated" value={relativeTime(profile.lastUpdatedAt)} />
            <Fact
              label="Items held"
              value={`${profile.items.length} · ${profile.sources.length} source${profile.sources.length === 1 ? "" : "s"}`}
            />
          </Panel>

          <Panel label="Timeline">
            <Timeline entries={profile.timeline} />
          </Panel>

          <Panel label="Sources">
            <ul className="space-y-1.5">
              {profile.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-baseline gap-1.5 text-[0.8125rem] text-muted transition-colors hover:text-ink"
                  >
                    <span className="underline decoration-[rgb(var(--hair)/0.25)] underline-offset-[3px]">
                      {s.name}
                    </span>
                    <span className="readout text-[0.7rem] text-faint">
                      {relativeTime(s.publishedAt)}
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label="What we don't know">
            <ul className="space-y-2">
              {profile.unknowns.map((u) => (
                <li key={u} className="flex gap-2 text-[0.8125rem] leading-snug text-muted">
                  <Info className="mt-[3px] h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.9} />
                  <span>{u}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </motion.div>
  );
}

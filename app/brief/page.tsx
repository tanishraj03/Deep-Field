import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Empty, Eyebrow, Glass, Tag } from "@/components/ui";
import { getSnapshot } from "@/lib/snapshot";
import { istDate, relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Section({ title, lines, numbered = false }: {
  title: string; lines: string[]; numbered?: boolean;
}) {
  return (
    <section>
      <Eyebrow className="mb-2.5">{title}</Eyebrow>
      {lines.length === 0 ? (
        <p className="text-[0.875rem] text-faint">Nothing today.</p>
      ) : (
        <ol className="space-y-2.5">
          {lines.map((l, n) => (
            <li key={l} className="flex gap-3 text-[0.9375rem] leading-[1.6]">
              {numbered && (
                <span className="readout shrink-0 pt-[3px] text-[0.75rem] font-semibold text-faint tabular-nums">
                  {String(n + 1).padStart(2, "0")}
                </span>
              )}
              <span className="text-ink/85">{l}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function BriefPage() {
  const snapshot = await getSnapshot();
  const b = snapshot.brief;

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <Link
        href="/"
        className="press inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Today
      </Link>

      <header>
        <Eyebrow>Under three minutes</Eyebrow>
        <h1 className="mt-1 text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.5rem]">Daily Brief</h1>
        <p className="readout mt-2 text-[0.8125rem] text-muted">{istDate()}</p>
        {b && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone="outline">
              {b.theSignal.generatedBy === "gemini" ? "AI interpretation" : "Rules only"}
            </Tag>
            <span className="readout text-[0.7rem] text-faint">
              Written {relativeTime(b.generatedAt)}
            </span>
          </div>
        )}
      </header>

      {!b ? (
        <Empty
          title="No brief has been written yet."
          action="Trigger a collection from Settings → System, or wait for tomorrow's 7:30 AM run."
        />
      ) : (
        <>
          <Glass className="p-6 sm:p-7">
            <Eyebrow className="mb-3">The Signal</Eyebrow>
            <p className="text-[1.1875rem] font-medium leading-[1.45] tracking-[-0.017em]">
              {b.theSignal.headline}
            </p>
            <p className="hairline mt-4 pt-4 text-[0.9375rem] leading-[1.65] text-ink/75">
              {b.theSignal.reasoning}
            </p>
          </Glass>

          <Glass className="space-y-7 p-6 sm:p-7">
            <Section title="The 5 things you should know" lines={b.fiveThings} numbered />
            <div className="hairline pt-6"><Section title="What's moving" lines={b.whatsMoving} /></div>
            <div className="hairline pt-6"><Section title="Money moves" lines={b.moneyMoves} /></div>
            <div className="hairline pt-6"><Section title="Who's spending" lines={b.whosSpending} /></div>
            <div className="hairline pt-6"><Section title="Who we should talk to" lines={b.whoToTalkTo} numbered /></div>
            <div className="hairline pt-6"><Section title="Watch" lines={b.watch} /></div>
          </Glass>

          <p className="readout text-center text-[0.7rem] text-faint">
            Free-tier limits apply. Delivered to Slack each morning at 8:00 AM IST.
          </p>
        </>
      )}
    </div>
  );
}

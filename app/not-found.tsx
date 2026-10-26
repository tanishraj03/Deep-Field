import Link from "next/link";
import { Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-16">
      <Card className="p-8 text-center">
        <p className="eyebrow">Not here</p>
        <h1 className="mt-2 text-[1.375rem] font-semibold tracking-tight">This page has moved on.</h1>
        <p className="mt-2 text-sm text-muted">
          Topics are rebuilt every scan, so an older link can outlive the conversation it pointed to.
        </p>
        <Link href="/" className="press mt-5 inline-block rounded-pill bg-ink px-4 py-2 text-[0.8125rem] font-semibold text-canvas">
          Back to Pulse
        </Link>
      </Card>
    </div>
  );
}

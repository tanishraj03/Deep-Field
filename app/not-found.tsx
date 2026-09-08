import Link from "next/link";
import { Glass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-16">
      <Glass className="p-8 text-center">
        <p className="readout text-[0.7rem] uppercase tracking-[0.14em] text-faint">404</p>
        <h1 className="mt-2 text-[1.375rem] font-semibold tracking-tight">This screen doesn&apos;t exist.</h1>
        <p className="mt-2 text-[0.875rem] text-muted">Head back to Today and start from the signal.</p>
        <Link href="/" className="press mt-5 inline-block rounded-pill bg-[rgb(var(--hair)/0.07)] px-4 py-2 text-[0.8125rem] font-semibold">
          Open Today
        </Link>
      </Glass>
    </div>
  );
}

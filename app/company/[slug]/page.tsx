import Link from "next/link";
import { CompanyView } from "@/components/company-view";
import { Glass } from "@/components/ui";
import { buildCompanyProfile, listCompanies } from "@/lib/company";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = buildCompanyProfile((await getSnapshot()).items, slug);
  return { title: profile ? `${profile.name} · Deep Field` : "Company not held" };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getSnapshot();
  const profile = buildCompanyProfile(snapshot.items, slug);

  if (!profile) {
    const others = listCompanies(snapshot.items).slice(0, 8);
    return (
      <Glass className="px-6 py-14 text-center">
        <p className="text-[0.95rem] font-medium">We hold nothing on this company.</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          Profiles are built only from items already collected — nothing is fetched on
          demand. It may have aged out of the retention window, or never appeared in a
          source we read.
        </p>
        {others.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {others.map((c) => (
              <Link
                key={c.slug}
                href={`/company/${c.slug}`}
                className="press rounded-pill bg-[rgb(var(--hair)/0.06)] px-3 py-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </Glass>
    );
  }

  return <CompanyView profile={profile} />;
}

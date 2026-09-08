import { SectionView } from "@/components/section-view";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  return (
    <SectionView
      snapshot={await getSnapshot()}
      kicker="Opportunity engine"
      title="Who We Should Talk To"
      variant="opportunity"
      defaultWindow={7}
    />
  );
}

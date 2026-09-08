import { SectionView } from "@/components/section-view";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  return (
    <SectionView
      snapshot={await getSnapshot()}
      kicker="Funding intelligence"
      title="Money Moves"
      type="funding"
      defaultWindow={1}
    />
  );
}

import { SectionView } from "@/components/section-view";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function SpendPage() {
  return (
    <SectionView
      snapshot={await getSnapshot()}
      kicker="Marketing activity"
      title="Who's Spending"
      type="marketing"
      defaultWindow={3}
    />
  );
}

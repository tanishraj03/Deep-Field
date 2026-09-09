import { SectionView } from "@/components/section-view";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  return (
    <SectionView
      snapshot={await getSnapshot()}
      kicker="Social intelligence"
      title="What's Moving"
      type="trend"
      showStrength
      showPlatformTabs
      defaultWindow={3}
    />
  );
}

import { SavedView } from "@/components/saved-view";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  return <SavedView snapshot={await getSnapshot()} />;
}

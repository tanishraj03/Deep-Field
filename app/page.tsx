import { Today } from "@/components/today";
import { getSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  return <Today snapshot={await getSnapshot()} />;
}

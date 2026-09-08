import { SettingsView } from "@/components/settings-view";
import { getSystemStatus } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  return <SettingsView status={await getSystemStatus()} />;
}

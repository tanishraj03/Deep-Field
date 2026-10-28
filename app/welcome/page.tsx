import { redirect } from "next/navigation";
import { Onboarding } from "@/components/onboarding";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome" };

/** After the first sign-in: a username, then up to five skippable questions. ?edit=1 revisits them. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const [{ edit }, user] = await Promise.all([searchParams, currentUser()]);
  if (!user) redirect("/login");
  if (user.username && !edit) redirect("/");
  return (
    <Onboarding
      firstName={user.name.split(" ")[0]}
      suggested={user.username ?? suggestUsername(user.name, user.email)}
      initialPrefs={user.prefs}
      editing={!!user.username}
    />
  );
}

function suggestUsername(name: string, email: string): string {
  const base = (name || email.split("@")[0]).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const s = /^[a-z]/.test(base) ? base : `u_${base}`;
  return s.slice(0, 20).replace(/_+$/, "");
}

import { Lock } from "lucide-react";
import { KeysManager } from "@/components/keys-manager";
import { requireUser, usesServerKeys } from "@/lib/auth";
import { keyStatus } from "@/lib/auth/users";

export const dynamic = "force-dynamic";
export const metadata = { title: "Keys" };

export default async function KeysPage() {
  const user = await requireUser();
  const owner = usesServerKeys(user);
  const status = await keyStatus(user);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Keys</h1>
        <p className="mt-1 text-sm text-muted">
          DeepField runs on your own keys. Everything you do here spends only your keys, never anyone else&apos;s, and nobody else can use yours.
        </p>
        <p className="mt-3 flex items-start gap-2 text-xs text-faint">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
          Keys are checked with the provider, encrypted before they are stored, and only used on the server for your own requests. They never reach your browser again; you only see the last four characters.
        </p>
        {owner && (
          <p className="mt-2 rounded-xl bg-hair/[0.05] px-3 py-2 text-xs text-muted">
            This account is linked to DeepField&apos;s own keys, so they show as connected here. Change one to use a different key, or remove it to switch it off for your account. No other account can use them.
          </p>
        )}
      </div>
      <KeysManager initial={status} owner={owner} />
    </div>
  );
}

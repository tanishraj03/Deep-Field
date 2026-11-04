"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Card } from "./ui";

/** Delete your account, after typing your username to confirm. */
export function DeleteAccount({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Couldn't delete the account.");
      window.location.assign("/login");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Delete your account</p>
          <p className="mt-0.5 text-sm text-muted">Removes your profile, saved keys, feed answers, track record and votes. This can&apos;t be undone.</p>
        </div>
        {!open && <Button variant="ghost" onClick={() => setOpen(true)} className="text-fall"><Trash2 className="h-3.5 w-3.5" />Delete account</Button>}
      </div>
      {open && (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(e) => { e.preventDefault(); if (typed.trim().toLowerCase() === username) remove(); }}>
          <label className="flex-1">
            <span className="sr-only">Type your username to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus placeholder={`Type ${username} to confirm`} spellCheck={false}
              className="h-9 w-full rounded-lg bg-canvas px-3 text-sm outline-none ring-1 ring-hair/15 focus:ring-2 focus:ring-fall/50" />
          </label>
          <div className="flex gap-1.5">
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setTyped(""); setError(null); }}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={typed.trim().toLowerCase() !== username} className="bg-fall text-white ring-0 hover:opacity-90">Delete for good</Button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-fall" role="alert">{error}</p>}
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Check, ExternalLink, Eye, EyeOff, KeyRound, RotateCcw, Trash2 } from "lucide-react";
import type { KeyField } from "@/lib/keys";
import { INTEGRATIONS, type Integration, type IntegrationStatus } from "@/lib/keys-catalog";
import { cn, relativeTime } from "@/lib/utils";
import { InfoPopover } from "./info-popover";
import { Badge, Button, Card, Eyebrow } from "./ui";

/** How to get one key: the steps, a link straight to the page, and any warning. */
export function KeyGuide({ i }: { i: Integration }) {
  return (
    <>
      <p className="font-semibold text-ink">How to get your {i.name} key</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4">{i.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      {i.note && <p className="mt-2 rounded-lg bg-hair/[0.05] px-2.5 py-1.5">{i.note}</p>}
      <p className="mt-2 text-faint">Cost: {i.cost}</p>
      <a href={i.url} target="_blank" rel="noreferrer" className="mt-2.5 inline-flex items-center gap-1 font-medium text-accent hover:underline">
        Open {new URL(i.url).hostname.replace(/^www\./, "")}<ExternalLink className="h-3 w-3" />
      </a>
    </>
  );
}

export function KeysManager({ initial, owner }: { initial: IntegrationStatus[]; owner: boolean }) {
  const [status, setStatus] = useState(initial);
  const byId = new Map(status.map((s) => [s.id, s]));
  const groups = [
    { label: "AI models", sub: "Power the assistant, AI-named conversations in scans, Explore insights and rescans. Add at least one free key.", items: INTEGRATIONS.filter((i) => i.group === "ai") },
    { label: "Data sources", sub: "Optional. Add more platforms and live numbers to scans and Explore.", items: INTEGRATIONS.filter((i) => i.group === "data") },
  ];
  const anyAi = status.some((s) => (s.saved || s.fromServer) && INTEGRATIONS.find((i) => i.id === s.id)?.group === "ai");

  return (
    <div className="space-y-8">
      {!anyAi && (
        <Card className="flex items-start gap-3 border-accent/30 bg-accent/[0.04] p-4">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-sm">
            <span className="font-medium">Start with a free Gemini key.</span>{" "}
            <span className="text-muted">It takes about a minute, needs no card, and unlocks the assistant, AI insights and rescans. Tap the <span className="whitespace-nowrap">ⓘ</span> next to any key for the steps.</span>
          </p>
        </Card>
      )}
      {groups.map((g) => (
        <section key={g.label}>
          <Eyebrow>{g.label}</Eyebrow>
          <p className="mb-3 mt-1 text-xs text-faint">{g.sub}</p>
          <Card className="divide-y">
            {g.items.map((i) => <KeyRow key={i.id} i={i} s={byId.get(i.id)!} owner={owner} onChange={setStatus} />)}
          </Card>
        </section>
      ))}
    </div>
  );
}

function KeyRow({ i, s, owner, onChange }: { i: Integration; s: IntegrationStatus; owner: boolean; onChange: (s: IntegrationStatus[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Partial<Record<KeyField, string>>>({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | "restore" | null>(null);
  const connected = s.saved || s.fromServer;
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "note"; text: string } | null>(null);

  const save = async () => {
    setBusy("save"); setMsg(null);
    try {
      const res = await fetch("/api/keys", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integration: i.id, values }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Couldn't save the key.");
      onChange(json.keys);
      setEditing(false); setValues({}); setShow(false);
      setMsg(json.note ? { tone: "note", text: json.note } : { tone: "ok", text: "Key checked and saved." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy("restore"); setMsg(null);
    try {
      const res = await fetch("/api/keys", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ integration: i.id, restoreServer: true }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Couldn't switch the server key back on.");
      onChange(json.keys);
      setMsg({ tone: "ok", text: "Server key connected again." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const what = s.fromServer
      ? `Disconnect the server's ${i.name} key from your account? You can reconnect it here any time.`
      : `Remove your ${i.name} key? Anything that uses it stops working until you add one again.`;
    if (!confirm(what)) return;
    setBusy("remove"); setMsg(null);
    try {
      const res = await fetch(`/api/keys?integration=${i.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Couldn't remove the key.");
      onChange(json.keys);
      setMsg({ tone: "ok", text: s.fromServer ? "Disconnected." : "Removed." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const filled = i.fields.every((f) => values[f.field]?.trim());

  return (
    <div className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium">{i.name}</p>
            <InfoPopover label={`How to get a ${i.name} key`}><KeyGuide i={i} /></InfoPopover>
            {i.recommended && <Badge tone="accent">Recommended</Badge>}
            <Badge tone={i.free ? "neutral" : "ember"}>{i.free ? "Free" : "Paid"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">{i.unlocks}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs">
            {connected ? (
              <span className="flex flex-wrap items-center gap-1 text-rise">
                <Check className="h-3.5 w-3.5" />Connected{s.hint && <> · ends in <code className="num">{s.hint}</code></>}
                <span className="text-faint">
                  {s.saved ? (s.savedAt ? ` · added ${relativeTime(s.savedAt)}` : "") : " · server key, only your account can use it"}
                </span>
              </span>
            ) : s.serverOff ? (
              <span className="text-faint">Disconnected · the server has a key you can reconnect</span>
            ) : (
              <span className="text-faint">Not connected{i.withoutIt && <> · {i.withoutIt}</>}</span>
            )}
          </p>
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-1.5">
            {connected && <Button size="sm" variant="ghost" loading={busy === "remove"} onClick={remove} aria-label={`Remove ${i.name} key`}><Trash2 className="h-3.5 w-3.5" />Remove</Button>}
            {s.serverOff && owner && <Button size="sm" variant="ghost" loading={busy === "restore"} onClick={restore}><RotateCcw className="h-3.5 w-3.5" />Reconnect server key</Button>}
            <Button size="sm" variant={connected ? "secondary" : "primary"} onClick={() => { setEditing(true); setMsg(null); }}>
              {connected ? "Change" : "Add key"}
            </Button>
          </div>
        )}
      </div>

      {editing && (
        <form className="mt-3 space-y-2.5" onSubmit={(e) => { e.preventDefault(); if (filled) save(); }}>
          {i.fields.map((f, n) => (
            <label key={f.field} className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
              <span className="relative block">
                <input
                  type={show ? "text" : "password"} autoComplete="off" spellCheck={false} autoFocus={n === 0}
                  placeholder={f.placeholder} value={values[f.field] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))}
                  className="h-10 w-full rounded-xl bg-canvas px-3 pr-10 font-mono text-[0.8125rem] outline-none ring-1 ring-hair/15 transition focus:ring-2 focus:ring-accent/50"
                />
                {n === 0 && (
                  <button type="button" onClick={() => setShow((x) => !x)} aria-label={show ? "Hide key" : "Show key"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </span>
            </label>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[0.6875rem] text-faint">Checked with {i.name} before saving, then stored encrypted. Never shown again.</p>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="ghost" type="button" onClick={() => { setEditing(false); setValues({}); setMsg(null); }}>Cancel</Button>
              <Button size="sm" variant="primary" type="submit" loading={busy === "save"} disabled={!filled}>{busy === "save" ? "Checking" : "Save"}</Button>
            </div>
          </div>
        </form>
      )}

      {msg && (
        <p role={msg.tone === "error" ? "alert" : "status"}
          className={cn("mt-2 text-xs", msg.tone === "error" ? "text-fall" : msg.tone === "note" ? "text-ember" : "text-rise")}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "@/lib/config";
import { envKeys, KEY_FIELDS, NO_KEYS, type KeyField, type KeySet } from "@/lib/keys";
import { INTEGRATIONS, type IntegrationId, type IntegrationStatus } from "@/lib/keys-catalog";
import { EMPTY_PREFS, type FeedPrefs } from "@/lib/prefs";
import { store } from "@/lib/store";

/**
 * Users, their usernames and the keys they bring, as documents in the same
 * store as everything else:
 *
 *   user:<uid>         profile and feed preferences
 *   username:<name>    { uid }, so a username belongs to one account
 *   keys:<uid>         that user's API keys, each encrypted (AES-256-GCM)
 *
 * Keys never leave the server: the Keys page only ever sees the last four
 * characters.
 */

export interface User {
  /** "g:" + the Google account's stable id. */
  id: string;
  email: string;
  name: string;
  picture: string | null;
  username: string | null;
  prefs: FeedPrefs;
  createdAt: string;
  lastLoginAt: string;
}

const userKey = (uid: string) => `user:${uid}`;
const nameKey = (username: string) => `username:${username.toLowerCase()}`;
const keysKey = (uid: string) => `keys:${uid}`;

/** The one account allowed to spend the server's own keys. */
export const isOwner = (u: Pick<User, "email"> | null | undefined) => !!u && u.email.toLowerCase() === config.auth.ownerEmail;

export async function getUser(uid: string): Promise<User | null> {
  const doc = await store.get<User>(userKey(uid));
  return doc ? { ...doc.value, prefs: { ...EMPTY_PREFS, ...doc.value.prefs } } : null;
}

/** Create the account on first sign-in, refresh name and picture after. */
export async function upsertGoogleUser(g: { sub: string; email: string; name: string; picture: string | null }): Promise<User> {
  const id = `g:${g.sub}`;
  const now = new Date().toISOString();
  const existing = await getUser(id);
  const user: User = existing
    ? { ...existing, email: g.email, name: g.name, picture: g.picture, lastLoginAt: now }
    : { id, email: g.email, name: g.name, picture: g.picture, username: null, prefs: EMPTY_PREFS, createdAt: now, lastLoginAt: now };
  await store.set(userKey(id), user);
  return user;
}

/* ───────────── usernames ───────────── */

export const USERNAME_RULE = "3 to 20 characters: lowercase letters, numbers and underscores, starting with a letter.";
const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;
const RESERVED = new Set(["admin", "root", "deepfield", "deep_field", "support", "help", "api", "keys", "settings", "login", "welcome", "owner"]);

export function checkUsername(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().toLowerCase().replace(/^@/, "");
  if (!USERNAME_RE.test(name)) return { ok: false, error: `Usernames are ${USERNAME_RULE}` };
  if (RESERVED.has(name)) return { ok: false, error: "That username is reserved. Try another." };
  return { ok: true, name };
}

export async function usernameTaken(name: string, exceptUid?: string): Promise<boolean> {
  const doc = await store.get<{ uid: string }>(nameKey(name));
  return !!doc && doc.value.uid !== exceptUid;
}

export async function setUsername(user: User, raw: string): Promise<User> {
  const check = checkUsername(raw);
  if (!check.ok) throw new Error(check.error);
  if (check.name === user.username) return user;
  if (await usernameTaken(check.name, user.id)) throw new Error("That username is taken. Try another.");
  await store.set(nameKey(check.name), { uid: user.id });
  if (user.username) await store.remove(nameKey(user.username)).catch(() => {});
  const next = { ...user, username: check.name };
  await store.set(userKey(user.id), next);
  return next;
}

export async function savePrefs(user: User, prefs: FeedPrefs): Promise<User> {
  const next = { ...user, prefs };
  await store.set(userKey(user.id), next);
  return next;
}

/* ───────────── keys ───────────── */

/** Saved keys by field, plus the server keys the owner switched off from the Keys page. */
type StoredKeys = Partial<Record<KeyField, { v: string; at: string }>> & { off?: KeyField[] };

function cipherKey() {
  if (!config.auth.secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`deep-field:keys:${config.auth.secret}`).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url")}`;
}

function decrypt(packed: string): string | null {
  try {
    const raw = Buffer.from(packed.replace(/^v1:/, ""), "base64url");
    const d = createDecipheriv("aes-256-gcm", cipherKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    // Encrypted under an older AUTH_SECRET: treat as not saved.
    return null;
  }
}

async function storedKeys(uid: string): Promise<StoredKeys> {
  return (await store.get<StoredKeys>(keysKey(uid)))?.value ?? {};
}

/** The user's own keys, decrypted. */
export async function savedKeys(uid: string): Promise<KeySet> {
  const stored = await storedKeys(uid);
  const out: KeySet = { ...NO_KEYS };
  for (const f of KEY_FIELDS) {
    const v = stored[f]?.v;
    if (v) out[f] = decrypt(v) ?? "";
  }
  return out;
}

/**
 * The keys a user's requests spend. Everyone gets only their own. The owner
 * also falls back to the server's keys for anything they have not added.
 */
export async function keysFor(user: User): Promise<KeySet> {
  const [stored, own] = await Promise.all([storedKeys(user.id), savedKeys(user.id)]);
  if (!isOwner(user)) return own;
  const server = envKeys();
  const off = new Set(stored.off ?? []);
  return Object.fromEntries(KEY_FIELDS.map((f) => [f, own[f] || (off.has(f) ? "" : server[f])])) as unknown as KeySet;
}

export async function saveKeys(uid: string, values: Partial<Record<KeyField, string>>): Promise<void> {
  const stored = await storedKeys(uid);
  const at = new Date().toISOString();
  for (const [f, v] of Object.entries(values) as [KeyField, string][]) {
    if (v) stored[f] = { v: encrypt(v), at };
  }
  stored.off = (stored.off ?? []).filter((f) => !(f in values));
  await store.set(keysKey(uid), stored);
}

/**
 * Remove a saved key. When the owner removes a key that only the server
 * provides, the server key is switched off for them instead, since an
 * environment variable can't be deleted from here; restoreServerKeys
 * switches it back on.
 */
export async function removeKeys(user: User, fields: KeyField[]): Promise<void> {
  const stored = await storedKeys(user.id);
  const hadOwn = fields.some((f) => stored[f]);
  for (const f of fields) delete stored[f];
  if (!hadOwn && isOwner(user)) stored.off = [...new Set([...(stored.off ?? []), ...fields])];
  await store.set(keysKey(user.id), stored);
}

export async function restoreServerKeys(uid: string, fields: KeyField[]): Promise<void> {
  const stored = await storedKeys(uid);
  stored.off = (stored.off ?? []).filter((f) => !fields.includes(f));
  await store.set(keysKey(uid), stored);
}

export async function keyStatus(user: User): Promise<IntegrationStatus[]> {
  const [stored, own] = await Promise.all([storedKeys(user.id), savedKeys(user.id)]);
  const server = isOwner(user) ? envKeys() : NO_KEYS;
  const off = new Set(stored.off ?? []);
  return INTEGRATIONS.map((i) => {
    const fields = i.fields.map((f) => f.field);
    const saved = fields.every((f) => own[f]);
    const onServer = fields.every((f) => server[f]);
    const serverOff = onServer && fields.some((f) => off.has(f));
    const fromServer = !saved && onServer && !serverOff;
    const first = saved ? own[fields[0]] : fromServer ? server[fields[0]] : "";
    return {
      id: i.id as IntegrationId,
      saved,
      hint: first ? first.slice(-4) : null,
      fromServer,
      serverOff: !saved && serverOff,
      savedAt: saved ? stored[fields[0]]?.at ?? null : null,
    };
  });
}

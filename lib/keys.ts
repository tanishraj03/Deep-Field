import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "@/lib/config";

/**
 * Whose API keys the current piece of work spends.
 *
 * Every signed-in user brings their own keys, so a request runs inside
 * runWithKeys() with that user's set and every model call, YouTube search or
 * Reddit token in that request reads from it. Nothing reads process.env keys
 * directly any more: the server's own keys (.env.local / Vercel) are handed
 * out only to the owner's requests, the scheduled scan, and command-line
 * scripts.
 *
 * Outside any request on the Next.js server there is no key at all, so a
 * code path that forgets to pick a user cannot quietly spend the owner's
 * credits. Command-line scripts (tsx, no NEXT_RUNTIME) get the env keys.
 */

export interface KeySet {
  gemini: string;
  groq: string;
  cerebras: string;
  openrouter: string;
  mistral: string;
  xai: string;
  youtube: string;
  redditClientId: string;
  redditClientSecret: string;
  instagramToken: string;
  instagramUserId: string;
}

export type KeyField = keyof KeySet;

export const KEY_FIELDS: KeyField[] = [
  "gemini", "groq", "cerebras", "openrouter", "mistral", "xai",
  "youtube", "redditClientId", "redditClientSecret", "instagramToken", "instagramUserId",
];

export const NO_KEYS: KeySet = Object.freeze(Object.fromEntries(KEY_FIELDS.map((f) => [f, ""])) as unknown as KeySet);

/** The server's own keys from the environment. Only for the owner, the scheduler and scripts. */
export function envKeys(): KeySet {
  return {
    ...config.keys,
    youtube: config.youtube.apiKey,
    redditClientId: config.reddit.clientId,
    redditClientSecret: config.reddit.clientSecret,
    instagramToken: config.instagram.accessToken,
    instagramUserId: config.instagram.userId,
  };
}

const scope = new AsyncLocalStorage<KeySet>();

export function currentKeys(): KeySet {
  return scope.getStore() ?? (process.env.NEXT_RUNTIME ? NO_KEYS : envKeys());
}

export function runWithKeys<T>(keys: KeySet, fn: () => T): T {
  return scope.run(keys, fn);
}

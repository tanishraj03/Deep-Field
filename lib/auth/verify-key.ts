import { PROVIDERS, type ProviderId } from "@/lib/ai/models";
import { config } from "@/lib/config";
import type { KeyField } from "@/lib/keys";
import type { IntegrationId } from "@/lib/keys-catalog";

/**
 * One cheap call to check a key before it is saved, so a typo shows up on
 * the Keys page rather than halfway through a scan. "unknown" (the provider
 * was unreachable or answered oddly) still saves, with a note.
 */
export type KeyCheck = { result: "valid" } | { result: "invalid"; reason: string } | { result: "unknown"; reason: string };

const timeout = () => AbortSignal.timeout(10_000);

async function provider(id: ProviderId, key: string): Promise<KeyCheck> {
  const res = await fetch(`${PROVIDERS[id].baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: timeout() });
  if (res.ok) return { result: "valid" };
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return { result: "invalid", reason: `${PROVIDERS[id].name} rejected this key. Check you copied all of it.` };
  }
  return { result: "unknown", reason: `${PROVIDERS[id].name} answered HTTP ${res.status}, so the key could not be checked.` };
}

async function youtube(key: string): Promise<KeyCheck> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&regionCode=US&key=${encodeURIComponent(key)}`, { signal: timeout() });
  if (res.ok) return { result: "valid" };
  const body = await res.text().catch(() => "");
  if (/accessNotConfigured|SERVICE_DISABLED|has not been used/i.test(body)) {
    return { result: "invalid", reason: "This key works, but YouTube Data API v3 is not enabled on its project. Enable it in Google Cloud Console, then save again." };
  }
  if (/API key not valid|keyInvalid|API_KEY_INVALID/i.test(body) || res.status === 400) {
    return { result: "invalid", reason: "YouTube rejected this key. Check you copied all of it." };
  }
  if (/quotaExceeded/i.test(body)) return { result: "valid" };
  return { result: "unknown", reason: `YouTube answered HTTP ${res.status}, so the key could not be checked.` };
}

async function reddit(id: string, secret: string): Promise<KeyCheck> {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": config.reddit.userAgent,
    },
    body: "grant_type=client_credentials",
    signal: timeout(),
  });
  if (res.ok) return { result: "valid" };
  if (res.status === 401) return { result: "invalid", reason: "Reddit rejected this client id and secret. Check the app is a \"script\" app." };
  return { result: "unknown", reason: `Reddit answered HTTP ${res.status}, so the app could not be checked.` };
}

async function instagram(token: string, userId: string): Promise<KeyCheck> {
  const res = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(userId)}?fields=id,username&access_token=${encodeURIComponent(token)}`, { signal: timeout() });
  if (res.ok) return { result: "valid" };
  const body = await res.text().catch(() => "");
  const msg = body.match(/"message"\s*:\s*"([^"]{0,200})/)?.[1];
  if (res.status === 400 || res.status === 401 || res.status === 190) {
    return { result: "invalid", reason: `Meta rejected this token or user id${msg ? `: ${msg}` : "."}` };
  }
  return { result: "unknown", reason: `Meta answered HTTP ${res.status}, so the token could not be checked.` };
}

export async function verifyKey(id: IntegrationId, v: Partial<Record<KeyField, string>>): Promise<KeyCheck> {
  try {
    if (id === "youtube") return await youtube(v.youtube!);
    if (id === "reddit") return await reddit(v.redditClientId!, v.redditClientSecret!);
    if (id === "instagram") return await instagram(v.instagramToken!, v.instagramUserId!);
    return await provider(id, v[id]!);
  } catch (e) {
    return { result: "unknown", reason: `Could not reach the provider to check the key (${(e as Error).message}).` };
  }
}

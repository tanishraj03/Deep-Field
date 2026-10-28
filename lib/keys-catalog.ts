import type { KeyField } from "./keys";

/**
 * Every key a user can bring, with how to get it. Shared by the Keys page,
 * the Help page and the server routes that save and check keys, so it holds
 * no secrets and is safe to import in the browser.
 */

export type IntegrationId =
  | "gemini" | "groq" | "cerebras" | "openrouter" | "mistral" | "xai"
  | "youtube" | "reddit" | "instagram";

export interface Integration {
  id: IntegrationId;
  name: string;
  group: "ai" | "data";
  /** What adding it unlocks, in one line. */
  unlocks: string;
  cost: string;
  free: boolean;
  recommended?: boolean;
  fields: { field: KeyField; label: string; placeholder: string }[];
  url: string;
  /** Plain steps for the info popover. */
  steps: string[];
  note?: string;
  /** What still works when it is not connected, shown next to "Not connected". */
  withoutIt?: string;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "gemini", name: "Google Gemini", group: "ai", recommended: true, free: true,
    unlocks: "The assistant, AI-named conversations in scans, Explore insights and \"what's being said\"",
    cost: "Free, no card needed",
    fields: [{ field: "gemini", label: "API key", placeholder: "AIza…" }],
    url: "https://aistudio.google.com/apikey",
    steps: [
      "Open Google AI Studio and sign in with any Google account.",
      "Click \"Create API key\". Pick any project, or let it create one.",
      "Copy the key (it starts with AIza) and paste it here.",
    ],
    note: "Don't attach a billing account: the free tier doesn't need one, and without billing you can never be charged.",
  },
  {
    id: "groq", name: "Groq", group: "ai", free: true,
    unlocks: "Qwen 3.8 and GPT-OSS 120B in the assistant, the fastest replies. Also a backup for scans",
    cost: "Free, about 30 requests a minute",
    fields: [{ field: "groq", label: "API key", placeholder: "gsk_…" }],
    url: "https://console.groq.com/keys",
    steps: [
      "Open the Groq console and sign up (Google sign-in works).",
      "Go to API Keys and click \"Create API Key\".",
      "Copy it (it starts with gsk_). Groq shows it only once.",
    ],
  },
  {
    id: "cerebras", name: "Cerebras", group: "ai", free: true,
    unlocks: "Ultra-fast drafts in the assistant",
    cost: "Free, about 1M tokens a day (short context)",
    fields: [{ field: "cerebras", label: "API key", placeholder: "csk-…" }],
    url: "https://cloud.cerebras.ai",
    steps: [
      "Open Cerebras Cloud and sign up.",
      "Open \"API Keys\" in the left menu and create a key.",
      "Copy it (it starts with csk-).",
    ],
  },
  {
    id: "openrouter", name: "OpenRouter", group: "ai", free: true,
    unlocks: "DeepSeek, Qwen, Llama and other free models in the assistant",
    cost: "Free \":free\" models, 50 requests a day",
    fields: [{ field: "openrouter", label: "API key", placeholder: "sk-or-…" }],
    url: "https://openrouter.ai/keys",
    steps: [
      "Open OpenRouter and sign in.",
      "Go to Keys and click \"Create Key\". Leave the credit limit empty.",
      "Copy it (it starts with sk-or-).",
    ],
    note: "DeepField only calls OpenRouter's free models, so a key with no credits works.",
  },
  {
    id: "mistral", name: "Mistral", group: "ai", free: true,
    unlocks: "Mistral Medium in the assistant, strong for scripts and captions",
    cost: "Free Experiment plan (needs phone verification)",
    fields: [{ field: "mistral", label: "API key", placeholder: "Your Mistral key" }],
    url: "https://console.mistral.ai/api-keys",
    steps: [
      "Open the Mistral console and sign up.",
      "Choose the free \"Experiment\" plan and verify your phone number.",
      "Go to API Keys, create a key and copy it.",
    ],
  },
  {
    id: "xai", name: "xAI Grok", group: "ai", free: false,
    unlocks: "Grok in the assistant. Never used for background work",
    cost: "Paid, billed to your xAI credits",
    fields: [{ field: "xai", label: "API key", placeholder: "xai-…" }],
    url: "https://console.x.ai",
    steps: [
      "Open the xAI console and sign in.",
      "Buy credits under Billing (Grok has no free tier).",
      "Go to API Keys, create a key and copy it (it starts with xai-).",
    ],
    note: "Every Grok message spends your xAI credits. DeepField only uses Grok when you pick it.",
  },
  {
    id: "youtube", name: "YouTube Data API", group: "data", recommended: true, free: true,
    unlocks: "Trending videos in scans, most-viewed videos and view counts in Explore, and YouTube comments",
    cost: "Free, 10,000 units a day",
    fields: [{ field: "youtube", label: "API key", placeholder: "AIza…" }],
    url: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    steps: [
      "Open Google Cloud Console and create a project (or pick one).",
      "Open the \"YouTube Data API v3\" page and click Enable.",
      "Go to APIs & Services → Credentials → Create credentials → API key.",
      "Copy the key (it starts with AIza).",
    ],
    note: "Your Gemini key will not work here: it is a different kind of key, even though both start with AIza.",
  },
  {
    id: "reddit", name: "Reddit API", group: "data", free: true,
    unlocks: "Live upvote and comment counts on brand-new threads (otherwise counts settle about 36 hours after posting)",
    cost: "Free, but Reddit must approve your app first",
    withoutIt: "Reddit still works through the public archive",
    fields: [
      { field: "redditClientId", label: "Client id", placeholder: "The string under your app's name" },
      { field: "redditClientSecret", label: "Client secret", placeholder: "secret" },
    ],
    url: "https://www.reddit.com/prefs/apps",
    steps: [
      "Reddit no longer lets you create a key yourself: since late 2025 every new app needs Reddit's approval under its Responsible Builder Policy.",
      "If you want to try, sign in to Reddit, open reddit.com/prefs/apps and follow the prompt to request API access. Describe it as personal, non-commercial research.",
      "If Reddit approves it, create a \"script\" app with http://localhost as the redirect uri.",
      "The client id is the short string under the app's name; the secret is labelled \"secret\". Paste both here.",
    ],
    note: "You can skip this one. Reddit approvals are slow and often refused, and DeepField already reads every Reddit thread, comment and upvote through a free public archive. Only counts on threads under about 36 hours old are missing.",
  },
  {
    id: "instagram", name: "Instagram (Meta Graph API)", group: "data", free: true,
    unlocks: "Top Instagram posts with likes and comments in Explore",
    cost: "Free, 30 hashtags a week",
    fields: [
      { field: "instagramToken", label: "Access token", placeholder: "Long-lived token (EAA…)" },
      { field: "instagramUserId", label: "Instagram user id", placeholder: "1784…" },
    ],
    url: "https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search",
    steps: [
      "You need an Instagram Business or Creator account linked to a Facebook Page.",
      "Create a Meta app at developers.facebook.com and add the Instagram Graph API product with the instagram_basic permission.",
      "Generate a long-lived user access token in the Graph API Explorer.",
      "Get your Instagram user id: GET /me/accounts, then /{page-id}?fields=instagram_business_account.",
    ],
    note: "The most involved one. Skip it unless Instagram numbers matter to you.",
  },
];

export const INTEGRATION_BY_ID = new Map(INTEGRATIONS.map((i) => [i.id, i]));

/** What the Keys page shows for one integration. Never the key itself. */
export interface IntegrationStatus {
  id: IntegrationId;
  /** The user saved this key themselves. */
  saved: boolean;
  /** Last four characters of the first field, to tell keys apart. */
  hint: string | null;
  /** The owner's account falls back to the server's own key. */
  fromServer: boolean;
  /** The owner switched the server's key off from the Keys page. */
  serverOff: boolean;
  savedAt: string | null;
}

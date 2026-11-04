/**
 * What language a post or topic is in, from its text alone: no API, so it
 * works on every scan, including ones grouped without AI. Scripts decide
 * most languages outright (Tamil, Bengali, Japanese…); Latin-script text is
 * told apart by common words, which also catches Hinglish, Hindi written in
 * English letters. Good enough to label a topic, not to translate it.
 */

const SCRIPTS: [RegExp, string][] = [
  [/[஀-௿]/g, "Tamil"],
  [/[ఀ-౿]/g, "Telugu"],
  [/[ಀ-೿]/g, "Kannada"],
  [/[ഀ-ൿ]/g, "Malayalam"],
  [/[ঀ-৿]/g, "Bengali"],
  [/[઀-૿]/g, "Gujarati"],
  [/[਀-੿]/g, "Punjabi"],
  [/[଀-୿]/g, "Odia"],
  [/[ऀ-ॿ]/g, "Hindi"],
  [/[؀-ۿ]/g, "Arabic"],
  [/[぀-ヿ]/g, "Japanese"],
  [/[가-힯]/g, "Korean"],
  [/[一-鿿]/g, "Chinese"],
  [/[Ѐ-ӿ]/g, "Russian"],
  [/[฀-๿]/g, "Thai"],
];

/** Words common in one Latin-script language and rare in English titles. */
const WORDS: [string, Set<string>][] = [
  ["Spanish", new Set("el la los las del de que qué por para con una uno está están cómo como pero más fue sobre este esta hoy también ya sin muy".split(" "))],
  ["Portuguese", new Set("não é são com uma um para pelo pela mais isso está estão você muito sobre hoje também já de da do como o os".split(" "))],
  ["Italian", new Set("il lo gli della delle dei di e per che non sono più come anche questo questa molto perché".split(" "))],
  ["French", new Set("le les des une est pour avec dans sur pas qui que ce cette sont aussi très mais".split(" "))],
  ["German", new Set("der die das und ist nicht mit ein eine für auf auch sich den dem wie noch".split(" "))],
  ["Indonesian", new Set("yang dan ini itu dengan untuk tidak dari ada akan juga sudah bisa kami".split(" "))],
  ["Hinglish", new Set("hai hain kya ki ka ke ko nahi nahin aur bhi tha thi kaise kyun yeh ye woh wo mein bhai sabse kab hoga".split(" "))],
];

/** Marathi shares Devanagari with Hindi; these words are Marathi's own. */
const MARATHI = /(?:^|\s)(आहे|आहेत|नाही|आणि|झाला|झाली|केले|होते|मध्ये)(?=\s|$|[,.!?])/;
/** Urdu-only letters, to tell it from Arabic. */
const URDU = /[ٹڈڑںےۓ]/;

export function languageOf(text: string): string {
  let best: { lang: string; n: number } | null = null;
  for (const [re, lang] of SCRIPTS) {
    const n = text.match(re)?.length ?? 0;
    if (n > (best?.n ?? 0)) best = { lang, n };
  }
  if (best && best.n >= 3) {
    if (best.lang === "Hindi" && MARATHI.test(text)) return "Marathi";
    if (best.lang === "Arabic" && URDU.test(text)) return "Urdu";
    return best.lang;
  }
  // Letters English doesn't use settle it for the two Romance languages most often seen.
  if (/[ãõ]|ção\b|ções\b/i.test(text)) return "Portuguese";
  if (/[ñ¿¡]/.test(text)) return "Spanish";
  const words = text.toLowerCase().normalize("NFC").split(/[^\p{L}]+/u).filter(Boolean);
  if (words.length < 3) return "English";
  let latin: { lang: string; hits: number } | null = null;
  for (const [lang, set] of WORDS) {
    const hits = words.filter((w) => set.has(w)).length;
    if (hits > (latin?.hits ?? 0)) latin = { lang, hits };
  }
  // Two hits, and a fair share of the words: a Spanish name in an English title stays English.
  return latin && latin.hits >= 2 && latin.hits / words.length >= 0.15 ? latin.lang : "English";
}

/**
 * A topic's language: the one most of its threads are in, when that is not
 * English. Undefined for English or evenly mixed topics.
 */
export function topicLanguage(texts: string[]): string | undefined {
  if (!texts.length) return undefined;
  const counts = new Map<string, number>();
  for (const t of texts) {
    const l = languageOf(t);
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const [lang, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return lang !== "English" && n / texts.length >= 0.5 ? lang : undefined;
}

/** Where a topic is happening, from its India / global split, in words. */
export function regionWords(postsIN: number, postsGLOBAL: number): string {
  const total = postsIN + postsGLOBAL;
  if (!total) return "";
  const india = postsIN / total;
  return india >= 0.7 ? "trending in India" : india <= 0.3 ? "trending globally" : "trending in India and globally";
}

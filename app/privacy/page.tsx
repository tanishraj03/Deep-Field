import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Privacy" };

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "What DeepField keeps about you",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>From Google sign-in: your name, email address and profile picture. Nothing else from your Google account.</li>
        <li>The username you pick and your answers to the sign-up questions (niches, audience, platforms and so on).</li>
        <li>API keys you add. Each is encrypted before it is stored and is only ever used on the server for your own requests. It is never shown back to anyone, you included: the Keys page shows only its last four characters.</li>
        <li>Feedback you give: votes on verdicts, topics you mark as made, and the results and links you report for them.</li>
        <li>Counts of what you use (searches, chats, scans), when you last visited, and a log of sign-ins with the time, the approximate city and country your hosting provider reports, and your browser type. IP addresses are not kept.</li>
      </ul>
    ),
  },
  {
    title: "What it doesn't keep",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Your assistant chats are kept in your own browser, not on DeepField&apos;s servers.</li>
        <li>Explore searches are counted without your name, in a way that can&apos;t be traced back to you. A search is shown to others only once several different people have made it, and nobody can see who searched what.</li>
        <li>No ads, no selling or sharing your data, no tracking across other sites.</li>
      </ul>
    ),
  },
  {
    title: "Who else is involved",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Google, to sign you in.</li>
        <li>The AI provider whose model you use (Google Gemini, Groq, Mistral and so on), with your own key: your questions and the research behind them are sent to that provider under its terms.</li>
        <li>The hosting providers DeepField runs on, which store its data.</li>
        <li>Public sources DeepField reads (Reddit, YouTube, Hacker News, news, Wikipedia, Bluesky, Mastodon and others). Nothing about you is sent to them.</li>
      </ul>
    ),
  },
  {
    title: "Deleting your data",
    body: <>Settings → Your account → Delete account removes your profile, keys, answers, feedback and activity for good. To revoke a key everywhere, also delete it with the provider that issued it.</>,
  },
  {
    title: "Questions",
    body: <>Write to <a href="mailto:woops.exe@gmail.com" className="text-accent hover:underline">woops.exe@gmail.com</a>.</>,
  },
];

/** Public, so people can read it before signing in. */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />DeepField</Link>
      <h1 className="mt-6 text-[1.75rem] font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted">What DeepField keeps, what it doesn&apos;t, and how to delete it. Plain language, no small print.</p>
      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-[1.05rem] font-semibold tracking-tight">{s.title}</h2>
            <div className="mt-2 text-sm leading-relaxed text-ink/85">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}

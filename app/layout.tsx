import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RegionProvider } from "@/components/region";
import { Shell } from "@/components/shell";
import { ThemeProvider } from "@/components/theme";
import { currentUser, isOwner } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "DeepField", template: "%s · DeepField" },
  description: "What the internet is talking about, in every niche, in India and globally, and what to make content about.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F8F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0C" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const account = user?.username
    ? { username: user.username, name: user.name, email: user.email, picture: user.picture, owner: isOwner(user) }
    : null;
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Runs before paint so the first frame is never the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('df-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <RegionProvider fallback={user?.prefs.region ?? null}>
            <Shell account={account}>{children}</Shell>
          </RegionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

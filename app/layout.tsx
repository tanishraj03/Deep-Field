import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Chrome } from "@/components/chrome";
import { ThemeProvider } from "@/components/theme";

export const metadata: Metadata = {
  title: "Deep Field",
  description: "What changed on the internet this morning, and who to talk to about it.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F1EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0C0E" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Both run before paint: the first frame is never the wrong theme, and a
          first-time visitor never sees an empty feed flash before setup.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('df-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}
try{var p=localStorage.getItem('df-prefs');var done=p&&JSON.parse(p).completedAt;if(!done&&location.pathname!=='/welcome'){location.replace('/welcome');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <Chrome>{children}</Chrome>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        hair: "rgb(var(--hair) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable"', '"Segoe UI"', 'Inter', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', '"Cascadia Mono"', '"Roboto Mono"', 'monospace'],
      },
      fontSize: {
        eyebrow: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.14em", fontWeight: "600" }],
      },
      borderRadius: { tile: "1.375rem", module: "1.75rem", pill: "999px" },
      boxShadow: {
        tile: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.14)",
        module: "0 2px 6px rgb(0 0 0 / 0.05), 0 24px 60px -28px rgb(0 0 0 / 0.28)",
        inset: "inset 0 1px 0 0 rgb(255 255 255 / 0.5)",
      },
      backdropBlur: { glass: "28px" },
      transitionTimingFunction: { ios: "cubic-bezier(0.32, 0.72, 0, 1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

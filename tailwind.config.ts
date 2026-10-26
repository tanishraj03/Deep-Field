import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        raised: token("raised"),
        ink: token("ink"),
        muted: token("muted"),
        faint: token("faint"),
        hair: token("hair"),
        accent: token("accent"),
        ember: token("ember"),
        rise: token("rise"),
        fall: token("fall"),
        india: token("india"),
        global: token("global"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "BlinkMacSystemFont", '"SF Pro Text"', '"Segoe UI Variable"', '"Segoe UI"', "Roboto", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", '"SF Mono"', "Menlo", "monospace"],
      },
      borderRadius: { pill: "999px" },
      transitionTimingFunction: { ios: "cubic-bezier(0.32, 0.72, 0, 1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

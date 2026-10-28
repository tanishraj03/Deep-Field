import { cn } from "@/lib/utils";

/**
 * Where each shooting star starts, how long its cycle is and when it first
 * goes. Long cycles with a short streak in each, so at most one is usually
 * crossing the screen at a time.
 */
const STREAKS = [
  { top: "12%", left: "58%", cycle: 11, delay: 1.5 },
  { top: "4%", left: "84%", cycle: 14, delay: 6 },
  { top: "30%", left: "96%", cycle: 17, delay: 10.5 },
  { top: "2%", left: "36%", cycle: 19, delay: 14 },
];

/**
 * The backdrop behind every screen: three soft colour fields and a faint,
 * still starfield (it is called DeepField). Pure CSS, fixed behind the page.
 *
 * Nothing here moves inside the app. The cards sit on top of this, and a
 * backdrop that animates makes the browser repaint everything above it on
 * every frame, which is what made switching tabs and scrolling feel slow.
 * The colour fields are gradients rather than blurred shapes for the same
 * reason. "hero" adds a few very faint shooting stars, for the sign-in and
 * welcome screens only.
 */
export function Ambient({ variant = "app" }: { variant?: "app" | "hero" }) {
  const hero = variant === "hero";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={cn("ambient-field left-[-18%] top-[-26%] h-[60rem] w-[60rem] [--field:var(--accent)]", hero ? "opacity-[0.26] dark:opacity-[0.3]" : "opacity-[0.18] dark:opacity-[0.24]")} />
      <div className={cn("ambient-field right-[-20%] top-[0%] h-[52rem] w-[52rem] [--field:var(--ember)]", hero ? "opacity-[0.16] dark:opacity-[0.18]" : "opacity-[0.1] dark:opacity-[0.14]")} />
      <div className={cn("ambient-field bottom-[-34%] left-[22%] h-[58rem] w-[58rem] [--field:var(--global)]", hero ? "opacity-[0.18] dark:opacity-[0.22]" : "opacity-[0.12] dark:opacity-[0.18]")} />

      <div className="ambient-stars absolute inset-0 opacity-60" />

      {hero && STREAKS.map((s, i) => (
        <span key={i} className="shooting-star" style={{ top: s.top, left: s.left, animationDuration: `${s.cycle}s`, animationDelay: `${s.delay}s` }} />
      ))}

      {/* Fades everything into the canvas at the edges so it never fights the content. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(var(--canvas))_100%)] opacity-60" />
    </div>
  );
}

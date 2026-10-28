import { cn } from "@/lib/utils";

/**
 * The backdrop behind every screen: three soft colour fields, a faint
 * starfield (it is called DeepField) and radar rings echoing the logo.
 * Pure CSS, fixed behind the page. "hero" is the stronger, moving version
 * for the sign-in screen; inside the app it stays still and quiet so the
 * glass cards on top don't have to re-blur it on every frame.
 */
export function Ambient({ variant = "app" }: { variant?: "app" | "hero" }) {
  const hero = variant === "hero";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className={cn("ambient-blob left-[-12%] top-[-18%] h-[46rem] w-[46rem] bg-accent", hero ? "opacity-[0.22] dark:opacity-[0.26] animate-drift" : "opacity-[0.16] dark:opacity-[0.22]")} />
      <div className={cn("ambient-blob right-[-14%] top-[8%] h-[38rem] w-[38rem] bg-ember", hero ? "opacity-[0.14] dark:opacity-[0.16] animate-drift-slow" : "opacity-[0.09] dark:opacity-[0.13]")} />
      <div className={cn("ambient-blob bottom-[-24%] left-[28%] h-[44rem] w-[44rem] bg-global", hero ? "opacity-[0.16] dark:opacity-[0.2] animate-drift-slower" : "opacity-[0.11] dark:opacity-[0.17]")} />

      <div className={cn("ambient-stars absolute inset-0", hero ? "opacity-70 animate-twinkle" : "opacity-60")} />

      <svg
        className={cn("absolute text-ink", hero ? "right-[-14rem] top-1/2 h-[64rem] w-[64rem] -translate-y-1/2 opacity-[0.09]" : "right-[-18rem] top-[-18rem] h-[44rem] w-[44rem] opacity-[0.07]")}
        viewBox="0 0 200 200" fill="none"
      >
        {[20, 40, 60, 80, 98].map((r) => <circle key={r} cx="100" cy="100" r={r} stroke="currentColor" strokeWidth="0.35" />)}
        <path d="M100 2v196M2 100h196" stroke="currentColor" strokeWidth="0.25" />
      </svg>
      {hero && <div className="ambient-sweep absolute right-[-14rem] top-1/2 h-[64rem] w-[64rem] -translate-y-1/2 rounded-full" />}

      {/* Fades everything into the canvas at the edges so it never fights the content. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(var(--canvas))_100%)] opacity-60" />
    </div>
  );
}

/**
 * What shows while a screen loads: a thin bar along the top in the brand
 * gradient, sliding, and, only if loading takes more than a moment, the
 * DeepField mark breathing in the middle. Nothing that pretends to be the
 * page's layout, so it looks right before any screen, including ones
 * without the sidebar.
 */
export function LoadingBar() {
  return (
    <div role="status" aria-label="Loading">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-accent/10">
        <div className="loading-bar h-full w-1/3 rounded-r-full" />
      </div>
      <div className="loading-mark pointer-events-none fixed inset-0 z-[55] flex items-center justify-center">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-ink shadow-[0_0_48px_-8px_rgb(var(--accent)/0.6)]">
          <span className="absolute h-4 w-4 rounded-full border-2 border-canvas" />
          <span className="absolute h-1.5 w-1.5 translate-x-[7px] -translate-y-[7px] rounded-full bg-ember" />
        </span>
      </div>
    </div>
  );
}

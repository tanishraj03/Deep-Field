export default function Loading() {
  return (
    <div className="space-y-4 pt-6">
      <div className="h-10 w-40 animate-pulse rounded-tile" style={{ background: "rgb(var(--hair) / 0.06)" }} />
      <div className="h-44 animate-pulse rounded-module" style={{ background: "rgb(var(--hair) / 0.05)" }} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-module" style={{ background: "rgb(var(--hair) / 0.045)" }} />
        ))}
      </div>
    </div>
  );
}

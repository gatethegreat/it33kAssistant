export default function HomeLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-32 rounded bg-[var(--bg-elevated)] mb-3" />
      <div className="space-y-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-md">
            <div className="h-4 w-4 rounded bg-[var(--bg-elevated)]" />
            <div className="h-3.5 w-32 rounded bg-[var(--bg-elevated)]" />
            <div className="h-3 flex-1 rounded bg-[var(--bg-raised)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

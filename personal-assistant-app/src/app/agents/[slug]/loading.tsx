export default function AgentLoading() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-2 animate-pulse">
      <div className="h-3 w-16 rounded bg-[var(--bg-raised)] mb-6" />
      <div className="flex items-start gap-4 mb-8">
        <div className="h-8 w-8 rounded-md bg-[var(--bg-elevated)]" />
        <div className="flex-1">
          <div className="h-5 w-48 rounded bg-[var(--bg-elevated)] mb-2" />
          <div className="h-3.5 w-96 rounded bg-[var(--bg-raised)]" />
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-[var(--bg-raised)]" />
        ))}
      </div>
    </div>
  );
}

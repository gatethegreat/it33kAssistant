export default function AgentLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] -m-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[var(--border-subtle)]">
        <div className="h-5 w-5 rounded bg-[var(--bg-elevated)]" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-40 rounded bg-[var(--bg-elevated)]" />
          <div className="h-3 w-64 rounded bg-[var(--bg-raised)]" />
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="h-3 w-32 rounded bg-[var(--bg-raised)]" />
      </div>

      {/* Message bar skeleton */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)]" />
        </div>
      </div>
    </div>
  );
}

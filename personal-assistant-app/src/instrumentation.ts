export async function register() {
  // Only run on the server (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { cleanupStaleRuns } = await import("@/lib/agent-runner");
    cleanupStaleRuns().catch((err) => {
      console.error("[instrumentation] Failed to clean up stale runs:", err);
    });
  }
}

import type { AgentMeta } from "./types";

// Simple client-side cache for agent metadata.
// Populated by the homepage, consumed by agent detail pages — avoids
// a redundant /api/agents fetch on every navigation.

let cache: AgentMeta[] | null = null;

export function setAgentCache(agents: AgentMeta[]) {
  cache = agents;
}

export function getCachedAgents(): AgentMeta[] | null {
  return cache;
}

export function getCachedAgent(slug: string): AgentMeta | undefined {
  return cache?.find((a) => a.slug === slug);
}

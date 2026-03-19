"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentCard } from "@/components/agent-card";
import { CreateAgentModal } from "@/components/create-agent-modal";
import { setAgentCache } from "@/lib/agent-cache";
import type { AgentMeta } from "@/lib/types";
import { PlusIcon } from "@/components/icons";

export function AgentGrid({ agents: initialAgents }: { agents: AgentMeta[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [showCreate, setShowCreate] = useState(false);

  // Seed client-side cache
  useEffect(() => {
    setAgentCache(agents);
  }, [agents]);

  // Prefetch agent routes
  useEffect(() => {
    for (const agent of agents) {
      router.prefetch(`/agents/${agent.slug}`);
      router.prefetch(`/agents/${agent.slug}/chat`);
    }
  }, [agents, router]);

  const refreshAgents = () => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data: AgentMeta[]) => {
        const specialists = data.filter((a) => a.slug !== "main");
        setAgents(specialists);
        setAgentCache(specialists);
      });
  };

  // Listen for agent list changes
  useEffect(() => {
    const handler = () => refreshAgents();
    window.addEventListener("agents-updated", handler);
    return () => window.removeEventListener("agents-updated", handler);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          Specialist Agents
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <PlusIcon size={14} />
          New agent
        </button>
      </div>

      {/* Agent list — no cards, just rows with subtle separators */}
      <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
        {agents.map((agent) => (
          <AgentCard key={agent.slug} agent={agent} />
        ))}

        {agents.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-[13px] text-[var(--text-tertiary)]">No agents yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 text-[13px] text-[var(--accent-text)] hover:text-[var(--accent-hover)] transition-colors"
            >
              Create your first agent
            </button>
          </div>
        )}
      </div>

      <CreateAgentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          refreshAgents();
          window.dispatchEvent(new Event("agents-updated"));
        }}
      />
    </div>
  );
}

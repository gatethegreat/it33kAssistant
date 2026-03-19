"use client";

import Link from "next/link";
import type { AgentMeta } from "@/lib/types";
import { ChevronRightIcon } from "@/components/icons";

/** Tiny color dot derived from agent's assigned color */
function ColorDot({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span
      className="h-2 w-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function AgentCard({ agent }: { agent: AgentMeta }) {
  return (
    <Link
      href={`/agents/${agent.slug}/chat`}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
    >
      {/* Emoji or color dot */}
      <span className="text-base shrink-0 w-6 text-center">
        {agent.emoji || <ColorDot color={agent.color} />}
      </span>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {agent.name}
          </span>
          <ColorDot color={agent.color} />
        </div>
        {agent.description && (
          <p className="text-[12px] text-[var(--text-tertiary)] truncate mt-0.5">
            {agent.description}
          </p>
        )}
      </div>

      {/* Tool count */}
      {agent.tools.length > 0 && (
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
          {agent.tools.length} tools
        </span>
      )}

      {/* Chevron */}
      <ChevronRightIcon
        size={14}
        className="text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      />
    </Link>
  );
}

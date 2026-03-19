"use client";

import { useState } from "react";
import type { AgentMeta } from "@/lib/types";

interface RunFormProps {
  agent: AgentMeta;
  onRun: (prompt: string) => void;
  isRunning: boolean;
  isFollowUp?: boolean;
}

export function RunForm({ agent, onRun, isRunning, isFollowUp }: RunFormProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isRunning) return;
    onRun(prompt.trim());
    setPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isFollowUp && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (isFollowUp) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Follow up..."
          rows={1}
          className="flex-1 resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isRunning}
          className="rounded-md bg-[var(--accent)] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isRunning ? "..." : "Send"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-[12px] font-medium text-[var(--text-secondary)]">
        Prompt for {agent.name}
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter a prompt for this agent..."
        rows={3}
        className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-4 py-3 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
      />
      <button
        type="submit"
        disabled={!prompt.trim() || isRunning}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? "Running..." : "Run Agent"}
      </button>
    </form>
  );
}

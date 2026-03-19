"use client";

import { useState } from "react";
import type { AgentMeta } from "@/lib/types";
import type { SkillInfo } from "@/lib/capabilities";

interface ScheduleFormProps {
  agents: AgentMeta[];
  skills: SkillInfo[];
  onSubmit: (data: {
    agent_slug: string;
    agent_name: string;
    prompt: string;
    cron: string;
    skill_slug?: string;
  }) => void;
  isSubmitting: boolean;
}

const presets = [
  { label: "Every minute (test)", cron: "* * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily 9 AM", cron: "0 9 * * *" },
  { label: "Daily 3 PM", cron: "0 15 * * *" },
  { label: "Mon-Fri 9 AM", cron: "0 9 * * 1-5" },
  { label: "Weekly Monday 9 AM", cron: "0 9 * * 1" },
];

export function ScheduleForm({ agents, skills, onSubmit, isSubmitting }: ScheduleFormProps) {
  const [agentSlug, setAgentSlug] = useState("");
  const [skillSlug, setSkillSlug] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cron, setCron] = useState("0 9 * * *");

  const selectedAgent = agents.find((a) => a.slug === agentSlug);
  const selectedSkill = skills.find((s) => s.slug === skillSlug);

  const skillsByCategory = skills.reduce<Record<string, SkillInfo[]>>((acc, skill) => {
    (acc[skill.category] ??= []).push(skill);
    return acc;
  }, {});

  const canSubmit = agentSlug && cron.trim() && (prompt.trim() || skillSlug);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      agent_slug: agentSlug,
      agent_name: selectedAgent?.name || agentSlug,
      prompt: prompt.trim(),
      cron: cron.trim(),
      ...(skillSlug ? { skill_slug: skillSlug } : {}),
    });
    setPrompt("");
    setSkillSlug("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-5">
      <h3 className="text-[13px] font-medium text-[var(--text-primary)]">New Schedule</h3>

      <div>
        <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">Agent</label>
        <select
          value={agentSlug}
          onChange={(e) => setAgentSlug(e.target.value)}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:outline-none"
        >
          <option value="">Select an agent...</option>
          {agents.map((a) => (
            <option key={a.slug} value={a.slug}>{a.emoji} {a.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">Skill (optional)</label>
        <select
          value={skillSlug}
          onChange={(e) => setSkillSlug(e.target.value)}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:outline-none"
        >
          <option value="">No skill — use prompt only</option>
          {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
            <optgroup key={category} label={category}>
              {categorySkills.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {selectedSkill && (
          <p className="mt-1.5 rounded-md bg-[var(--bg-elevated)] px-3 py-1.5 text-[11px] text-[var(--text-tertiary)]">
            {selectedSkill.description}
          </p>
        )}
      </div>

      <div>
        <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">
          {skillSlug ? "Additional Instructions (optional)" : "Prompt"}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={skillSlug ? "Any extra instructions..." : "Enter the prompt for scheduled runs..."}
          rows={2}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[11px] text-[var(--text-tertiary)] mb-1">Cron Expression</label>
        <input
          value={cron}
          onChange={(e) => setCron(e.target.value)}
          placeholder="0 9 * * *"
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] font-mono placeholder-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {presets.map((p) => (
            <button
              key={p.cron}
              type="button"
              onClick={() => setCron(p.cron)}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                cron === p.cron
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating..." : "Create Schedule"}
      </button>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ScheduleForm } from "@/components/schedule-form";
import type { AgentMeta, AgentSchedule } from "@/lib/types";
import type { SkillInfo } from "@/lib/capabilities";

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    Promise.all([
      fetch("/api/schedules").then((r) => r.json()),
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/skills").then((r) => r.json()),
    ]).then(([sched, ag, sk]) => {
      setSchedules(sched);
      setAgents(ag);
      setSkills(sk);
      setLoading(false);
    });
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (data: { agent_slug: string; agent_name: string; prompt: string; cron: string; skill_slug?: string }) => {
    setIsSubmitting(true);
    await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setIsSubmitting(false);
    loadData();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/schedules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    loadData();
  };

  const getSkillName = (slug: string | null) => {
    if (!slug) return null;
    return skills.find((s) => s.slug === slug)?.name || slug;
  };

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Schedules</h1>
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-md bg-[var(--bg-raised)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Schedules</h1>

      <ScheduleForm agents={agents} skills={skills} onSubmit={handleCreate} isSubmitting={isSubmitting} />

      <div className="border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
        {schedules.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)] py-8 text-center">No schedules yet</p>
        ) : (
          schedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{schedule.agent_name}</span>
                  {schedule.skill_slug && (
                    <span className="rounded-md bg-[var(--accent-muted)] px-1.5 py-0.5 text-[11px] text-[var(--accent-text)]">
                      {getSkillName(schedule.skill_slug)}
                    </span>
                  )}
                  <code className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                    {schedule.cron}
                  </code>
                  <span className={`h-1.5 w-1.5 rounded-full ${schedule.enabled ? "bg-green-400" : "bg-[var(--text-muted)]"}`} />
                </div>
                {schedule.prompt && (
                  <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)] truncate">{schedule.prompt}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 ml-4 shrink-0">
                <button onClick={() => handleToggle(schedule.id, !schedule.enabled)}
                  className="rounded-md px-2.5 py-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
                  {schedule.enabled ? "Pause" : "Resume"}
                </button>
                <button onClick={() => handleDelete(schedule.id)}
                  className="rounded-md px-2.5 py-1 text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

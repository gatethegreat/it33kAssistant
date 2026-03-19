export interface AgentMeta {
  slug: string;
  name: string;
  description: string;
  tools: string[];
  mcpServers?: string[];
  color?: string;
  emoji?: string;
  vibe?: string;
  model?: string;
  filePath: string;
}

export interface AgentRun {
  id: string;
  agent_slug: string;
  agent_name: string;
  prompt: string;
  output: string | null;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  cost_usd: number | null;
  duration_ms: number | null;
  session_id: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  pending_approval: {
    tool_use_id: string;
    tool_name: string;
    tool_input: Record<string, unknown>;
  } | null;
  schedule_id: string | null;
  event_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunEvent {
  id: number;
  run_id: string;
  seq: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AgentSchedule {
  id: string;
  agent_slug: string;
  agent_name: string;
  prompt: string;
  cron: string;
  skill_slug: string | null;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  run_id: string | null;
  schedule_id: string | null;
  agent_slug: string;
  session_id: string | null;
  type: "completed" | "failed" | "needs_review" | "approval_needed";
  title: string;
  summary: string | null;
  read: boolean;
  created_at: string;
}

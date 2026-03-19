# PersonalAIssistant

A personal AI assistant platform built on Claude Code. Create, manage, and run AI agents through a web UI powered by the Claude Agent SDK.

## Quick Start

```bash
npx create-personalai my-assistant
```

That's it. The CLI walks you through:

1. **Anthropic API key** + **Supabase credentials**
2. Scaffolds the Next.js app + `.claude/` config (agents, skills, commands, hooks)
3. Optionally sets up **Google Workspace** (Gmail, Calendar, Drive, etc.)
4. Installs dependencies

Then:

```bash
cd my-assistant/personal-assistant-app
redis-server &          # Start Redis (needed for job queue)
npm run dev:all         # Start the app + worker
```

Open http://localhost:3000.

### Add to an Existing Project

If you already have a `.claude/` folder, just point at it:

```bash
npx create-personalai /path/to/your/project
```

The CLI merges **additively** — your existing files always win:

| What | Behavior |
|------|----------|
| **Agents** | Adds ours if no file with the same name exists |
| **Skills** | Adds ours if no skill directory with the same name exists |
| **Commands** | Adds ours if no file with the same name exists |
| **Hooks** | Adds safety hooks if not already present |
| **settings.local.json** | Merges hook config, preserves your permissions |
| **.mcp.json** | Adds chrome-devtools if missing, preserves your servers |

## What You Need

| Requirement | Where to Get It |
|-------------|----------------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **Redis** | `brew install redis` / `apt install redis-server` |
| **Anthropic API key** | [console.anthropic.com](https://console.anthropic.com) |
| **Supabase project** | [supabase.com](https://supabase.com) (free tier works) |

### Create Supabase Tables

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  output TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  cost_usd NUMERIC,
  duration_ms INTEGER,
  session_id TEXT,
  error TEXT,
  metadata JSONB DEFAULT '{}',
  pending_approval JSONB,
  schedule_id UUID,
  event_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE run_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID,
  schedule_id UUID,
  agent_slug TEXT NOT NULL,
  session_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE agent_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cron TEXT NOT NULL,
  skill_slug TEXT,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## What's Included

| Component | Description |
|-----------|-------------|
| `personal-assistant-app/` | Next.js 15 frontend + BullMQ worker for agent execution |
| `.claude/agents/` | Agent definitions (1 example included) |
| `.claude/commands/` | Claude Code slash commands (`/add-to-todos`, `/check-todos`) |
| `.claude/skills/` | Skills (frontend-design + 90+ Google Workspace skills included) |
| `.claude/hooks/` | Safety hooks (block destructive commands, auto-format, notifications) |
| `.mcp.json` | MCP server config (Chrome DevTools + Supabase) |

## Google Workspace

The setup CLI can install the [Google Workspace CLI](https://github.com/googleworkspace/cli) and its skills automatically. If you skip it during setup:

```bash
cd my-assistant
npm install @anthropic-ai/claude-code-google-workspace
npx gws auth setup --login
npx skills add https://github.com/googleworkspace/cli
```

This gives your agents access to Gmail, Calendar, Drive, Docs, Sheets, Chat, and more.

## Customizing

### Add Your Own Agents

Create a `.md` file in `.claude/agents/`:

```yaml
---
name: My Agent
description: What it does
tools: 'WebSearch, WebFetch, Read'
color: '#10B981'
emoji: "\U0001F916"
vibe: Short tagline
---
# Instructions for the agent...
```

### Add MCP Servers

Edit `.mcp.json`:

```json
{
  "mcpServers": {
    "your-server": {
      "command": "npx",
      "args": ["your-mcp-server"]
    }
  }
}
```

### Add Skills & Commands

- Skills: `.claude/skills/your-skill/SKILL.md`
- Commands: `.claude/commands/your-command.md`

Both are auto-discovered by the app and Claude Code.

## Security

- **Filesystem**: Agents can only read/write within the project directory
- **Network**: Agents can only reach `api.anthropic.com` and your Supabase instance
- **Bash**: Destructive commands blocked by hooks
- **Sandbox**: Claude Agent SDK's built-in `SandboxSettings`

## Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS 4
- **Agent SDK**: @anthropic-ai/claude-agent-sdk (with sandbox)
- **Queue**: BullMQ + Redis
- **Database**: Supabase (PostgreSQL)
- **MCP**: Chrome DevTools, Supabase (extensible)

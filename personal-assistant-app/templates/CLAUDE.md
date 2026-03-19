# PersonalAIssistant

## Identity

You are the user's personal AI assistant. You have full access to every tool, MCP server, skill, and subagent in this workspace. Handle tasks directly when you can, delegate to specialized subagents when their expertise produces better results.

## Architecture

This project is a personal assistant platform built on Claude Code. It consists of:

- **personal-assistant-app/** — A Next.js 15 frontend for managing and running AI agents
- **.claude/** — Claude Code configuration (agents, skills, commands, hooks)
- **assets/** — Static assets (fonts, images, documents)

## MCP Servers (auto-loaded from .mcp.json)

- **Chrome DevTools** (`mcp__chrome-devtools__*`) — Browser debugging, screenshots, DOM inspection

Add more MCP servers by editing `.mcp.json` at the project root.

## Creating Agents

Agents live in `.claude/agents/*.md`. Each agent has YAML frontmatter + markdown instructions:

```yaml
---
name: Agent Name
description: What this agent does
tools: 'WebSearch, WebFetch, Read'
color: '#8B5CF6'
emoji: "\U0001F52E"
vibe: Short tagline
---
# Agent instructions here...
```

The frontend auto-discovers agents from this directory.

## Creating Skills

Skills live in `.claude/skills/*/SKILL.md`. Each skill directory contains a `SKILL.md` with frontmatter:

```yaml
---
name: skill-name
description: What this skill does
---
Skill instructions here...
```

## Creating Commands

Commands live in `.claude/commands/*.md`. They become available as `/command-name` in Claude Code:

```yaml
---
description: What this command does
allowed-tools:
  - Read
  - Edit
---
Command instructions here...
```

## Hooks (automatic, no action needed)

Hooks fire automatically — do not invoke them manually:
- `block-destructive.sh` — Blocks dangerous bash commands (rm -rf, git reset --hard, etc.)
- `auto-approve-safe.sh` — Auto-approves safe read-only commands (ls, git status, etc.)
- `auto-format.sh` — Auto-formats code after edits (prettier for JS/TS, ruff for Python)
- `compaction-preserver.sh` — Preserves critical context during session compaction
- `notify.sh` — Desktop notifications when Claude needs attention

## Frontend Development

### Screenshot Feedback Loop

After generating frontend code, close the loop:
1. Take a screenshot with Chrome DevTools MCP (`take_screenshot`)
2. Check console for errors (`list_console_messages`)
3. If the design looks generic or has issues, fix and re-screenshot
4. Only report done after visual verification

## Running the App

```bash
# Prerequisites: Node.js 18+, Redis server

# 1. Install dependencies
cd personal-assistant-app && npm install

# 2. Copy and fill in environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase + Anthropic keys

# 3. Start Redis (required for BullMQ job queue)
redis-server

# 4. Start the app + worker
npm run dev:all
```

The app runs at http://localhost:3000.

## Session Continuity

- `/add-to-todos` — Capture tasks mid-work without breaking flow
- `/check-todos` — Review and pick up saved todos

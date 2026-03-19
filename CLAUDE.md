# PersonalAIssistant Base

## What This Is

This is the base/template repo for PersonalAIssistant — a web UI for creating and running Claude AI agents. Users run `npx create-personalai` and get a working agent platform that reads from their `.claude/` folder.

## Architecture

```
create-personalai/                — npx installer package
  index.js                        — CLI: prompts, scaffolding, GWS setup
  prepare-templates.js            — Copies templates into package before publish
  templates/                      — (generated at publish time from sources below)
personal-assistant-app/           — Next.js 15 + BullMQ worker
  src/app/                        — Pages: agents, runs, schedules, skills, settings
  src/app/api/                    — API routes (agents, runs, AI, settings, auth)
  src/components/                 — React components (chat, agent cards, modals, layout)
  src/lib/                        — Core logic (agent-runner, agents, types, capabilities)
  worker/index.ts                 — BullMQ worker that executes agents via Claude Agent SDK
  templates/                      — Source of truth for .claude/ config that ships to users
    claude/                       — Becomes .claude/ (agents, hooks, commands, skills, settings)
    mcp.json                      — Becomes .mcp.json
    CLAUDE.md                     — Becomes project root CLAUDE.md
  ecosystem.config.js             — PM2 config for production
docs/                             — Cloud provider guide, pricing
```

## Key Files

- **`src/lib/run-agent.ts`** — Core agent execution. Calls `query()` from Claude Agent SDK with sandbox settings, permission modes, MCP servers, and subagent definitions. This is where agents actually run.
- **`src/lib/agents.ts`** — Agent discovery. Reads `.claude/agents/*.md`, parses frontmatter, returns agent metadata. The "main" assistant is hardcoded here.
- **`src/lib/agent-runner.ts`** — Run lifecycle manager. Manages in-memory run contexts, SSE streaming, approval flows, and Supabase persistence.
- **`src/lib/capabilities.ts`** — Discovers skills, commands, MCP servers, and subagents from the filesystem.
- **`worker/index.ts`** — BullMQ worker for scheduled/background agent runs. Mirrors run-agent.ts logic but runs independently.
- **`src/app/api/settings/credentials/route.ts`** — Reads/writes `.env.local` and auto-configures Supabase MCP in `.mcp.json`.
- **`create-personalai/index.js`** — The `npx create-personalai` CLI. Handles interactive setup, file scaffolding, additive merging, and optional GWS integration.

## How Setup Works

`npx create-personalai [dir]` does the following:

1. Prompts for Anthropic API key and Supabase credentials
2. Scaffolds `personal-assistant-app/` into the target directory
3. Merges `.claude/` config additively (agents, commands, skills, hooks, settings)
4. Creates `.mcp.json` (merges if existing)
5. Writes `.env.local` with credentials
6. Runs `npm install`
7. Optionally installs Google Workspace CLI + skills

If the target directory already has `.claude/`, it merges additively — existing files always win.

## Security Model

- **Sandbox**: Agent execution is sandboxed via Claude Agent SDK's `SandboxSettings` — filesystem restricted to `PROJECT_ROOT/*`, network restricted to `api.anthropic.com` + Supabase domain.
- **Permissions**: Admin users get `bypassPermissions` (inside sandbox). Operators get `canUseTool` restrictions. Viewers are read-only.
- **Hooks**: `block-destructive.sh` catches dangerous bash commands before execution.

## Development

```bash
cd personal-assistant-app
npm install
cp .env.local.example .env.local  # Fill in Anthropic key + Supabase
redis-server                       # In another terminal
npm run dev:all                    # Next.js + worker
```

## Publishing the npx Package

```bash
cd create-personalai
npm install
npm run prepare-templates   # Copies app + templates into templates/
npm publish                 # prepublishOnly runs prepare-templates automatically
```

## Conventions

- `PROJECT_ROOT` env var controls where `.claude/`, `.mcp.json`, and `CLAUDE.md` are read from. Always use it instead of hardcoded paths.
- The main agent name is "My Assistant" — keep it generic, not personalized.
- Templates in `personal-assistant-app/templates/` are the source of truth for what gets deployed. Edit there, not in a top-level `.claude/`.
- The merge logic in `create-personalai/index.js` is additive only — never overwrite user's existing files.

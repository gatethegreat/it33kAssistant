# Agency Agent Platform — Handoff Doc

## Who This Is For

This document is a handoff from a planning conversation between Collin Gates (LogicWeave founder) and Claude. The next agent should use this to build out the agency use case described below.

## The Client

**Phil** — runs a marketing agency. Wants AI agents handling work across multiple clients, each with different brand voice, tools, and approval rules.

## What Phil Wants

In Phil's words: "I wish something would come in and then the agent would work according to that client and then check with a person before doing something just to make sure."

Broken down:

1. **Event-driven triggers** — Work starts when something arrives (email from client, scheduled content calendar, webhook from their CMS, Slack message from Phil). NOT someone typing into a Claude Code terminal.
2. **Client-aware execution** — The agent automatically knows which client it's working for and operates according to that client's brand voice, content strategy, approval rules, tools, and history.
3. **Human-in-the-loop approval** — Before taking any external/visible action (posting to social media, sending an email, publishing content), the agent pauses and checks with a human (Phil or a team member) via the dashboard. Internal work (drafting, research, analysis) runs autonomously.
4. **Dashboard visibility** — Phil sees all client work in one place, can approve/reject actions, review agent output, and intervene when needed.

## The Base App (What Already Exists)

This repo (`PersonalAIssistant`) is a fully working personal AI assistant with:

### Tech Stack
- **Next.js** full-stack app
- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — `query()` function for agent execution
- **Supabase** — auth, run persistence, event storage, notifications
- **BullMQ + Redis** — scheduled/cron-based agent runs
- **MCP servers** — ClickUp, Supabase, mem0, Chrome DevTools
- **SSE streaming** — real-time token/tool/event streaming to frontend

### Key Architecture Patterns

**Agent definitions** are markdown files in `.claude/agents/` with YAML frontmatter:
```yaml
name: "Agent Name"
description: "What this agent does"
tools: "Read, Write, Bash, Grep"
mcpServers: "clickup, supabase"
model: "claude-sonnet-4-6-20250514"
```
Body = markdown instructions appended to system prompt.

**Agent execution** is detached (fire-and-forget):
- `POST /api/runs` → create run record
- `POST /api/runs/{id}/start` → `executeDetached()` starts async, returns immediately
- `GET /api/runs/{id}/stream` → SSE stream of live events
- All events persisted to Supabase `run_events` table

**Permission model**:
- `admin` — full SDK bypass, no approval prompts
- `operator` — default mode + `canUseTool` callback for write operations
- `viewer` — restricted, read-only

**Approval flow** already exists via `onApprovalRequired` callback in `run-agent.ts`. Currently surfaces in the dashboard for operator-role users.

**System prompt** is built dynamically in `run-agent.ts` — combines CLAUDE.md + agent markdown body + user preferences.

### Key Files
| File | What It Does |
|------|-------------|
| `src/lib/agent-runner.ts` | Detached execution, RunContext registry, event emission |
| `src/lib/run-agent.ts` | SDK `query()` call, system prompt building, streaming |
| `src/lib/agents.ts` | Agent discovery from `.claude/agents/*.md` |
| `src/lib/auth-guard.ts` | Supabase Auth + role-based access control |
| `src/lib/capabilities.ts` | Tool filtering by role |
| `.claude/agents/*.md` | Agent definitions |
| `.mcp.json` | MCP server configs |
| `CLAUDE.md` | Main system prompt / project instructions |
| `worker/index.ts` | BullMQ worker for scheduled runs |

## What Needs to Be Built

### 1. Client Context Layer

The biggest addition. Each client needs isolated context that gets injected into every agent run.

**Client config** should include:
- Client name, slug, and basic info
- Brand voice document (tone, vocabulary, dos/don'ts)
- Content strategy (topics, pillars, posting schedule, platforms)
- Approval rules (what needs human approval, who approves, escalation paths)
- Budget limits (max spend per run, per day, per month)
- Active services (what the agency does for this client — social media, blog, email, etc.)

**Where to store it**: This is the cloned repo, so client config lives in the repo itself:
- `CLAUDE.md` — customized per client (brand context baked into the main system prompt)
- `.claude/agents/` — agent definitions tuned for this client's services
- `brand-docs/` — folder with brand voice, style guide, strategy docs
- `memory/` — project memory that builds up knowledge about this client over time
- `.mcp.json` — MCP connections to this client's tools (their CMS, CRM, social accounts)
- `.env.local` — API keys for this client's integrations

### 2. Event-Driven Triggers

Something needs to watch for incoming work and kick off agent runs. Options:

**Email-based**: Watch a client-specific inbox (or label) for incoming requests. Use Gmail API or a webhook.

**Webhook-based**: Client's CMS/CRM/tools send webhooks when something needs attention (new form submission, content approval needed, comment received).

**Scheduled**: Cron-based runs via BullMQ (already exists). E.g., "Every Tuesday at 8am, draft this week's social posts for this client."

**Slack/Chat**: Phil or team member messages a Slack channel, bot picks it up and routes to the right client's agent.

**Implementation**: Build an `/api/triggers` endpoint that:
1. Receives the event (email, webhook, Slack, cron)
2. Creates a run record with the trigger context
3. Calls `executeDetached()` with the client's agent config
4. Agent runs, hits approval gates for external actions
5. Notification surfaces in dashboard for Phil to approve/reject

### 3. Approval Flow Enhancement

The approval flow exists but needs to be more agency-friendly:

- **Categorize actions**: Define which tool calls need approval per client (posting = always approve, drafting = auto-approve, spending money = always approve)
- **Approval channels**: Dashboard (existing), plus optionally Slack DM or email notification to Phil
- **Approval queue**: A dedicated view showing all pending approvals across clients (if Phil manages multiple cloned instances, this could be a shared dashboard or each instance has its own)
- **Timeout handling**: If no approval within X hours, notify Phil again or auto-reject

### 4. Client Onboarding Flow

When Phil gets a new client:

1. Clone this base repo into a new directory/VM
2. Fill out client config:
   - Update `CLAUDE.md` with client brand context
   - Add brand docs to `brand-docs/`
   - Configure `.mcp.json` for client's tools
   - Set up `.env.local` with client API keys
   - Customize agent definitions in `.claude/agents/`
3. Set up event triggers (email watch, webhooks, cron schedule)
4. Create user accounts (Phil as admin, team members as operators)
5. Run initial agent session to populate mem0 with client knowledge

### 5. mem0 Namespacing

Each client instance should use a unique mem0 namespace:
- `user_id: "client-{client_slug}"` for client-specific brand knowledge
- `user_id: "phil"` for Phil's cross-client preferences (stored in a shared mem0 space)

This keeps client knowledge isolated while letting Phil's personal preferences follow him across instances.

## Architecture Decision: Repo Per Client

We considered two approaches:

| Approach | Pros | Cons |
|----------|------|------|
| **Multi-tenant (one app, many clients)** | Single deployment, easy maintenance, one dashboard | Complex isolation, shared failure domain, harder MCP per client |
| **Repo per client (clone base)** | Strong isolation, simple mental model, independent deploys, each client gets its own CLAUDE.md/memory/MCPs naturally | More repos to maintain, template drift, Phil switches between instances |

**Decision: Repo per client.** Reasons:
- Filesystem isolation is the simplest way to get per-client CLAUDE.md, memory, MCPs, and agent definitions
- Each client can have completely different tooling without dynamic config complexity
- If one client's agent misbehaves, it doesn't affect others
- Matches how Claude Code/Agent SDK naturally works (project-level context)
- Template updates can be managed via git (base repo as upstream remote)

## Priority Order for Implementation

1. **Client context in this repo** — Customize CLAUDE.md, add brand-docs folder, configure agents for this specific client
2. **Approval flow categorization** — Define which actions auto-execute vs. need approval for this client
3. **Event triggers** — Start with scheduled runs (already exists via BullMQ), then add email/webhook triggers
4. **Dashboard tweaks** — Client name/branding in the UI, approval queue view
5. **Onboarding checklist** — Document the clone-and-configure process so it's repeatable

## Questions for the Building Agent

- What are this client's specific services? (social media management, blog writing, email campaigns, etc.)
- What external tools does this client use? (CMS, CRM, social platforms, email marketing tool)
- What's Phil's preferred approval channel? (dashboard only, or also Slack/email?)
- What events should trigger agent work? (scheduled calendar, incoming emails, webhooks?)
- What's the budget limit per run and per month for this client?

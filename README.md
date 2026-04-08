# Personal AI Assistant for Claude Code

A ready-to-use `.claude/` configuration that turns Claude Code into a personal assistant with full Google Workspace access. Clone, authenticate, and start managing your email, calendar, documents, and files through natural conversation.

## What You Get

- **8 pre-built agents** — inbox manager, meeting prep, schedule coordinator, doc drafter, weekly reporter, plus a 3-agent research verification system
- **Research verification loop** — say "research [topic]" and it spawns Researcher, Challenger, and Fact-Checker agents that loop until findings are verified (up to 3 rounds)
- **Google Workspace skills** — installed during setup via the GWS CLI wizard (Gmail, Calendar, Drive, Docs, Sheets, and more — you pick which ones)
- **Safety hooks** — blocks dangerous commands, auto-approves safe ones, auto-formats code, desktop notifications
- **Project workspaces** — each project gets its own context, memory, and resources folder so Claude picks up where you left off
- **Slash commands** — `/add-to-todos`, `/check-todos`

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/PersonalAIssistantBase.git my-assistant
cd my-assistant
npm install
```

That's it. `npm install` installs the [Google Workspace CLI](https://github.com/googleworkspace/cli) and runs a setup wizard that walks you through Google authentication. The wizard opens a browser window for Google sign-in so the assistant can access your Gmail, Calendar, Drive, Docs, Sheets, and other services.

If you skip Google auth during setup, run `npm run setup` later to connect.

### Start using it

```bash
claude
```

Claude Code reads the `.claude/` config automatically and becomes your personal assistant. Try:

- "What's on my calendar today?"
- "Show me my unread emails"
- "Draft a reply to the latest email from Sarah"
- "Find the Q1 report in my Drive"
- "Create a meeting for tomorrow at 2pm with john@example.com"

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed
- [Node.js 18+](https://nodejs.org)
- A Google account

## Project Structure

```
.claude/
├── agents/       # 8 agents (5 productivity + 3 research verification)
├── commands/     # Slash commands (/add-to-todos, /check-todos)
├── hooks/        # Auto-running safety and formatting hooks
├── skills/       # Research skill + GWS skills added during setup
└── settings.local.json  # Hook config and permissions
CLAUDE.md         # Assistant instructions and GWS usage guide
package.json      # Google Workspace CLI dependency
setup.js          # Post-install setup wizard
```

## Customization

### Add your own agents

Create a file in `.claude/agents/`:

```markdown
---
name: My Agent
description: What this agent does
tools: 'Read, WebSearch, Bash'
---

Instructions for the agent.
```

### Add your own skills

Create a folder in `.claude/skills/my-skill/` with a `SKILL.md` inside. Skills give the assistant specific knowledge or workflows.

### Reference docs from Google Drive

The assistant can read documents from any Google Drive folder you have access to. Just ask:

- "Read the doc in my 'Brand Guidelines' folder"
- "What's in the spreadsheet called 'Budget 2026'?"
- "Find all PDFs in the 'Contracts' folder"

## License

MIT

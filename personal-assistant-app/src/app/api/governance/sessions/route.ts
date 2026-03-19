import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

type RiskLevel = "critical" | "warning" | "info";

interface RiskRule {
  level: RiskLevel;
  label: string;
  test: (toolName: string, input: Record<string, unknown>) => boolean;
}

const RISK_RULES: RiskRule[] = [
  // Critical — destructive or dangerous
  {
    level: "critical",
    label: "Destructive delete",
    test: (tool, input) =>
      tool === "Bash" && /\brm\s+-rf\b/.test(String(input.command || "")),
  },
  {
    level: "critical",
    label: "Force push",
    test: (tool, input) =>
      tool === "Bash" &&
      /\bgit\s+push\s+.*--force\b/.test(String(input.command || "")),
  },
  {
    level: "critical",
    label: "Hard reset",
    test: (tool, input) =>
      tool === "Bash" &&
      /\bgit\s+reset\s+--hard\b/.test(String(input.command || "")),
  },
  {
    level: "critical",
    label: "Drop table",
    test: (tool, input) =>
      tool === "Bash" &&
      /\bDROP\s+TABLE\b/i.test(String(input.command || "")),
  },
  {
    level: "critical",
    label: "Env/credentials write",
    test: (tool, input) => {
      if (tool !== "Write" && tool !== "Edit") return false;
      const fp = String(input.file_path || input.filePath || "");
      return /\.(env|pem|key|credentials|secret)/.test(fp);
    },
  },
  {
    level: "critical",
    label: "Sudo command",
    test: (tool, input) =>
      tool === "Bash" && /\bsudo\b/.test(String(input.command || "")),
  },
  // Warning — potentially risky
  {
    level: "warning",
    label: "Package install",
    test: (tool, input) =>
      tool === "Bash" &&
      /\b(npm\s+(install|ci|uninstall)|pip3?\s+install)\b/.test(
        String(input.command || "")
      ),
  },
  {
    level: "warning",
    label: "Git push",
    test: (tool, input) =>
      tool === "Bash" && /\bgit\s+push\b/.test(String(input.command || "")),
  },
  {
    level: "warning",
    label: "File write",
    test: (tool) => tool === "Write" || tool === "Edit",
  },
  {
    level: "warning",
    label: "Config file modified",
    test: (tool, input) => {
      if (tool !== "Write" && tool !== "Edit") return false;
      const fp = String(input.file_path || input.filePath || "");
      return /\b(package\.json|tsconfig|\.mcp\.json|next\.config|CLAUDE\.md)\b/.test(fp);
    },
  },
  {
    level: "warning",
    label: "External network",
    test: (tool) => tool === "WebFetch" || tool === "WebSearch",
  },
];

function classifyRisk(
  toolName: string,
  input: Record<string, unknown>
): { level: RiskLevel; label: string } {
  for (const rule of RISK_RULES) {
    if (rule.test(toolName, input)) {
      return { level: rule.level, label: rule.label };
    }
  }
  return { level: "info", label: "Normal" };
}

// ---------------------------------------------------------------------------
// JSONL session parser
// ---------------------------------------------------------------------------

interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
  inputSummary: string;
  risk: { level: RiskLevel; label: string };
  timestamp: string;
}

interface SessionSummary {
  sessionId: string;
  project: string;
  startedAt: string;
  lastActivity: string;
  version: string;
  gitBranch: string;
  messageCount: number;
  toolCalls: ToolCall[];
  riskCounts: { critical: number; warning: number; info: number };
  highestRisk: RiskLevel;
}

const CLAUDE_DIR = path.join(
  process.env.HOME || "/home/collin",
  ".claude",
  "projects"
);

function summarizeInput(toolName: string, input: Record<string, unknown>): string {
  if (toolName === "Bash") return String(input.command || "").slice(0, 200);
  if (toolName === "Read") return String(input.file_path || "").slice(0, 200);
  if (toolName === "Write" || toolName === "Edit")
    return String(input.file_path || input.filePath || "").slice(0, 200);
  if (toolName === "Glob") return String(input.pattern || "").slice(0, 200);
  if (toolName === "Grep") return String(input.pattern || "").slice(0, 200);
  if (toolName === "Agent")
    return String(input.description || "").slice(0, 200);
  if (toolName === "WebFetch" || toolName === "WebSearch")
    return String(input.url || input.query || "").slice(0, 200);
  // MCP tools
  if (toolName.startsWith("mcp__"))
    return JSON.stringify(input).slice(0, 200);
  return JSON.stringify(input).slice(0, 150);
}

async function parseSession(
  filePath: string,
  projectName: string
): Promise<SessionSummary | null> {
  const sessionId = path.basename(filePath, ".jsonl");
  const toolCalls: ToolCall[] = [];
  let startedAt = "";
  let lastActivity = "";
  let version = "";
  let gitBranch = "";
  let messageCount = 0;

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = String(entry.timestamp || "");
    if (ts) {
      if (!startedAt || ts < startedAt) startedAt = ts;
      if (!lastActivity || ts > lastActivity) lastActivity = ts;
    }

    if (entry.version) version = String(entry.version);
    if (entry.gitBranch) gitBranch = String(entry.gitBranch);

    // Count user/assistant messages
    if (entry.type === "user" || entry.type === "assistant") {
      messageCount++;
    }

    // Extract tool_use blocks from assistant messages
    if (entry.type === "assistant") {
      const msg = entry.message as { content?: unknown[] } | undefined;
      if (msg?.content && Array.isArray(msg.content)) {
        for (const block of msg.content) {
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use" && b.name) {
            const toolName = String(b.name);
            const input = (b.input as Record<string, unknown>) || {};
            const risk = classifyRisk(toolName, input);
            toolCalls.push({
              toolName,
              input,
              inputSummary: summarizeInput(toolName, input),
              risk,
              timestamp: ts,
            });
          }
        }
      }
    }
  }

  if (messageCount === 0) return null;

  const riskCounts = { critical: 0, warning: 0, info: 0 };
  for (const tc of toolCalls) {
    riskCounts[tc.risk.level]++;
  }
  const highestRisk: RiskLevel = riskCounts.critical > 0
    ? "critical"
    : riskCounts.warning > 0
      ? "warning"
      : "info";

  return {
    sessionId,
    project: projectName,
    startedAt,
    lastActivity,
    version,
    gitBranch,
    messageCount,
    toolCalls,
    riskCounts,
    highestRisk,
  };
}

// ---------------------------------------------------------------------------
// GET /api/governance/sessions
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectFilter = searchParams.get("project"); // optional filter
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const riskFilter = searchParams.get("risk") as RiskLevel | null; // optional

  try {
    if (!fs.existsSync(CLAUDE_DIR)) {
      return NextResponse.json({ sessions: [], projects: [] });
    }

    const projectDirs = fs.readdirSync(CLAUDE_DIR).filter((d) => {
      const full = path.join(CLAUDE_DIR, d);
      return fs.statSync(full).isDirectory();
    });

    const projects = projectDirs.map((d) =>
      d.replace(/-/g, "/").replace(/^\//, "")
    );

    // Collect all JSONL files across projects (or filtered project)
    const filesToParse: { file: string; project: string }[] = [];

    for (const dir of projectDirs) {
      const projectName = dir.replace(/-/g, "/").replace(/^\//, "");
      if (projectFilter && projectName !== projectFilter && dir !== projectFilter) {
        continue;
      }
      const fullDir = path.join(CLAUDE_DIR, dir);
      const jsonlFiles = fs.readdirSync(fullDir).filter((f) => f.endsWith(".jsonl"));

      // Sort by mtime descending to get most recent first
      const withStats = jsonlFiles.map((f) => {
        const fp = path.join(fullDir, f);
        return { file: fp, mtime: fs.statSync(fp).mtimeMs, project: projectName };
      });
      withStats.sort((a, b) => b.mtime - a.mtime);

      for (const w of withStats) {
        filesToParse.push({ file: w.file, project: w.project });
      }
    }

    // Sort all files by mtime descending
    filesToParse.sort((a, b) => {
      const sa = fs.statSync(a.file).mtimeMs;
      const sb = fs.statSync(b.file).mtimeMs;
      return sb - sa;
    });

    // Parse sessions (limit to avoid huge responses)
    const sessions: SessionSummary[] = [];
    const parseLimit = limit * 2; // parse extra to allow risk filtering
    for (const { file, project } of filesToParse.slice(0, parseLimit)) {
      const session = await parseSession(file, project);
      if (!session) continue;
      if (riskFilter && session.highestRisk !== riskFilter) continue;
      sessions.push(session);
      if (sessions.length >= limit) break;
    }

    // Strip full tool inputs from response to keep payload small
    // (keep inputSummary for display)
    const lightweight = sessions.map((s) => ({
      ...s,
      toolCalls: s.toolCalls.map(({ input, ...rest }) => rest),
    }));

    // Aggregate stats
    const stats = {
      totalSessions: sessions.length,
      totalToolCalls: sessions.reduce((n, s) => n + s.toolCalls.length, 0),
      criticalCount: sessions.reduce((n, s) => n + s.riskCounts.critical, 0),
      warningCount: sessions.reduce((n, s) => n + s.riskCounts.warning, 0),
      infoCount: sessions.reduce((n, s) => n + s.riskCounts.info, 0),
    };

    return NextResponse.json({ sessions: lightweight, projects, stats });
  } catch (err) {
    console.error("Governance API error:", err);
    return NextResponse.json(
      { error: "Failed to parse session data" },
      { status: 500 }
    );
  }
}

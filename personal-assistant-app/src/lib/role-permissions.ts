// Role-based file/command permissions for agent execution.
// Operators get the same tools as admin, but a canUseTool wrapper blocks
// writes to protected paths and dangerous Bash commands.

import path from "path";
import type { Role } from "./auth-guard";

const PROJECT_ROOT = process.env.PROJECT_ROOT || "/mnt/c/Users/Admin/Documents/PersonalAIssistant";

// ---------------------------------------------------------------------------
// Protected paths — operators cannot write/edit these (relative to project root)
// ---------------------------------------------------------------------------

export const PROTECTED_PATHS = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  ".mcp.json",
  ".env",
  "CLAUDE.md",
  "MEMORY.md",
  "personal-assistant-app/src/",
  "personal-assistant-app/worker/",
  ".claude/agents/",
  ".claude/skills/",
  ".claude/settings",
  "next.config",
  "middleware.ts",
];

// ---------------------------------------------------------------------------
// Blocked Bash command patterns
// ---------------------------------------------------------------------------

export const BLOCKED_COMMANDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bnpm\s+(install|ci|uninstall|remove)\b/, reason: "npm install/uninstall is not allowed for operators" },
  { pattern: /\bpip3?\s+install\b/, reason: "pip install is not allowed for operators" },
  { pattern: /\brm\s+-rf\b/, reason: "rm -rf is not allowed for operators" },
  { pattern: /\bgit\s+push\b/, reason: "git push is not allowed for operators" },
  { pattern: /\bgit\s+reset\s+--hard\b/, reason: "git reset --hard is not allowed for operators" },
  { pattern: /\bgit\s+checkout\s+--\b/, reason: "git checkout -- is not allowed for operators" },
  { pattern: /\bgit\s+clean\b/, reason: "git clean is not allowed for operators" },
];

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Resolve an absolute or relative path to project-relative. Returns null if outside project. */
export function relativeToProject(filePath: string): string | null {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_ROOT, filePath);
  const normalized = path.normalize(abs);
  if (!normalized.startsWith(PROJECT_ROOT)) return null;
  return path.relative(PROJECT_ROOT, normalized);
}

/** Check if a project-relative path matches any protected prefix. */
export function isProtectedPath(relPath: string): boolean {
  return PROTECTED_PATHS.some((p) => {
    if (p.endsWith("/")) {
      return relPath.startsWith(p) || relPath === p.slice(0, -1);
    }
    return relPath === p || relPath.startsWith(p + "/");
  });
}

// ---------------------------------------------------------------------------
// Bash command checking
// ---------------------------------------------------------------------------

/** Check a Bash command for blocked patterns and redirects to protected paths. Returns denial reason or null. */
export function checkBashCommand(command: string): string | null {
  // Check blocked command patterns
  for (const { pattern, reason } of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return reason;
    }
  }

  // Check redirect operators targeting protected paths
  // Matches: > file, >> file, tee file, tee -a file
  const redirectPattern = /(?:>{1,2}|tee(?:\s+-a)?)\s+["']?([^\s;"'|&]+)/g;
  let match;
  while ((match = redirectPattern.exec(command)) !== null) {
    const target = match[1];
    const rel = relativeToProject(target);
    if (rel !== null && isProtectedPath(rel)) {
      return `Redirect to protected path: ${rel}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// canUseTool wrapper factory
// ---------------------------------------------------------------------------

type CanUseToolFn = (
  toolName: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; toolUseID: string }
) => Promise<{ behavior: "allow" } | { behavior: "deny"; message: string }>;

/**
 * Build a canUseTool function that wraps existing MCP approval logic
 * with role-based blocking.
 *
 * - admin: returns base canUseTool unchanged (no extra restrictions)
 * - operator: checks Write/Edit file paths and Bash commands before delegating to base
 * - viewer: returns undefined (viewer uses restricted allowedTools only)
 */
export function buildCanUseTool(
  role: Role,
  baseCanUseTool?: CanUseToolFn
): CanUseToolFn | undefined {
  if (role === "admin") return baseCanUseTool;
  if (role === "viewer") return undefined;

  // Operator: wrap with path/command checks
  return async (toolName, input, options) => {
    // Check Write/Edit file paths
    if (toolName === "Write" || toolName === "Edit") {
      const filePath = (input.file_path as string) || (input.filePath as string) || "";
      if (filePath) {
        const rel = relativeToProject(filePath);
        if (rel !== null && isProtectedPath(rel)) {
          return {
            behavior: "deny" as const,
            message: `Operators cannot modify protected file: ${rel}`,
          };
        }
      }
    }

    // Check Bash commands
    if (toolName === "Bash") {
      const command = (input.command as string) || "";
      const denial = checkBashCommand(command);
      if (denial) {
        return { behavior: "deny" as const, message: denial };
      }
    }

    // Delegate to base canUseTool (MCP approval logic) if present
    if (baseCanUseTool) {
      return baseCanUseTool(toolName, input, options);
    }

    return { behavior: "allow" as const };
  };
}

// ---------------------------------------------------------------------------
// Allowed tools per role
// ---------------------------------------------------------------------------

const DEFAULT_TOOLS = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Agent", "Mcp", "Task", "NotebookEdit", "AskUserQuestion"];
const VIEWER_TOOLS = ["Read", "Glob", "Grep"];

/** Return the tool list for a given role. */
export function getAllowedToolsForRole(role: Role, agentTools?: string[]): string[] {
  if (role === "viewer") return VIEWER_TOOLS;
  // Operator and admin get the agent's configured tools or the full default set
  return agentTools && agentTools.length > 0 ? agentTools : DEFAULT_TOOLS;
}

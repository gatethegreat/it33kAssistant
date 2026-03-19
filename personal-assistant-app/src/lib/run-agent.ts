import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getAgentContent, getAgents } from "./agents";
import { isReadOnlyMcpTool } from "./approval-store";
import { buildCanUseTool, getAllowedToolsForRole } from "./role-permissions";
import { supabase } from "./supabase";
import type { Role } from "./auth-guard";
import type { AgentMeta } from "./types";

const PROJECT_ROOT = process.env.PROJECT_ROOT || "/mnt/c/Users/Admin/Documents/PersonalAIssistant";

// Read MCP servers from .mcp.json so any additions are picked up automatically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMcpServers(): Record<string, any> {
  try {
    const mcpPath = path.join(PROJECT_ROOT, ".mcp.json");
    const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
    return raw.mcpServers || {};
  } catch {
    return {};
  }
}

// Read CLAUDE.md once for project context
function getProjectInstructions(): string {
  try {
    const claudeMd = path.join(PROJECT_ROOT, "CLAUDE.md");
    return fs.readFileSync(claudeMd, "utf-8").trim();
  } catch {
    return "";
  }
}

// Build subagent definitions from all agent .md files (for the main assistant)
// AgentMcpServerSpec = string | Record<string, McpServerConfig> — SDK expects an array of these
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSubagentDefinitions(excludeSlug?: string): Record<string, { description: string; prompt: string; tools: string[]; mcpServers?: Array<Record<string, any>> }> {
  const agents = getAgents();
  const allMcpServers = getMcpServers();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defs: Record<string, { description: string; prompt: string; tools: string[]; mcpServers?: Array<Record<string, any>> }> = {};

  for (const agent of agents) {
    if (agent.slug === excludeSlug || agent.slug === "main") continue;
    try {
      const raw = fs.readFileSync(agent.filePath, "utf-8");
      const { content } = matter(raw);

      // Filter MCP servers to only those the agent has been granted access to
      // Each element is { serverName: serverConfig } matching AgentMcpServerSpec format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let agentMcpServers: Array<Record<string, any>> | undefined;
      if (agent.mcpServers && agent.mcpServers.length > 0) {
        const matched = agent.mcpServers
          .filter((name) => allMcpServers[name])
          .map((name) => ({ [name]: allMcpServers[name] }));
        if (matched.length > 0) {
          agentMcpServers = matched;
        }
      }

      defs[agent.slug] = {
        description: agent.description,
        prompt: content.trim(),
        tools: agent.tools.length > 0 ? agent.tools : ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        ...(agentMcpServers ? { mcpServers: agentMcpServers } : {}),
      };
    } catch {
      // skip agents we can't read
    }
  }

  return defs;
}

export interface AgentRunResult {
  output: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
  aborted?: boolean;
}

export interface StreamCallbacks {
  onToken?: (text: string) => void;
  onToolCall?: (name: string, status: "start" | "end", detail?: { input?: unknown; result?: string }) => void;
  onThinking?: (active: boolean) => void;
  onProgress?: (info: string) => void;
  onResult?: (result: AgentRunResult) => void;
  onError?: (error: string) => void;
  onDebug?: (msg: string) => void;
  onSessionInit?: (sessionId: string) => void;
  onApprovalRequired?: (toolName: string, toolInput: Record<string, unknown>, toolUseId: string) => Promise<boolean>;
  signal?: AbortSignal;
}

export async function executeAgent(
  agent: AgentMeta,
  prompt: string,
  callbacks?: StreamCallbacks,
  resumeSessionId?: string,
  userRole?: Role,
  userEmail?: string
): Promise<AgentRunResult> {
  const startTime = Date.now();
  let output = "";
  let sessionId = "";
  let costUsd = 0;
  let aborted = false;
  // Track emitted tool starts to avoid duplicates when both stream_event
  // and assistant message fire for the same tool call
  let lastEmittedToolStart = "";
  // Map tool_use_id → { name, input } so we can attach input/result to end events
  const pendingTools = new Map<string, { name: string; input: unknown }>();
  // Cap tool result text sent through SSE to avoid huge payloads
  const TOOL_RESULT_MAX_CHARS = 8000;

  const debug = (msg: string) => {
    console.log(`[run-agent] ${msg}`);
    callbacks?.onDebug?.(msg);
  };

  debug(`Starting agent: ${agent.slug} (model: ${agent.model || "default"})`);
  debug(`CWD: ${PROJECT_ROOT}`);
  debug(`Prompt: ${prompt.slice(0, 100)}...`);

  // Build system prompt: CLAUDE.md is always the base.
  // For the "main" agent, CLAUDE.md IS the full system prompt and other agents become subagents.
  // For specialist agents, append their markdown body after CLAUDE.md.
  const isMainAgent = agent.slug === "main";
  const projectInstructions = getProjectInstructions();
  const agentBody = isMainAgent ? "" : getAgentContent(agent.slug);

  // Fetch user preferences if we have an email
  let userPreferences = "";
  if (userEmail) {
    try {
      const { data } = await supabase
        .from("user_preferences")
        .select("preferences")
        .eq("user_email", userEmail)
        .single();
      if (data?.preferences?.trim()) {
        userPreferences = data.preferences.trim();
      }
    } catch {
      // No preferences found — that's fine
    }
  }

  const systemPrompt = [
    projectInstructions,
    agentBody,
    userPreferences ? `## User Preferences\n\n${userPreferences}` : "",
  ].filter(Boolean).join("\n\n---\n\n");

  // Load subagent definitions for the main agent
  const subagents = isMainAgent ? getSubagentDefinitions() : undefined;

  debug(`System prompt length: ${systemPrompt.length} chars`);

  const stderrLines: string[] = [];

  // Permission handler: auto-approve safe tools, require approval for write MCP tools
  const hasApprovalHandler = !!callbacks?.onApprovalRequired;
  const effectiveRole: Role = userRole || "admin";

  // Admin gets full bypass — no permission prompts, no canUseTool restrictions.
  // Operators get canUseTool with MCP write approval + path/command blocking.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseMcpCanUseTool = (hasApprovalHandler && effectiveRole !== "admin")
    ? async (
        toolName: string,
        input: Record<string, unknown>,
        options: { signal: AbortSignal; toolUseID: string }
      ) => {
        // Auto-approve non-MCP tools (built-in: Bash, Read, Write, Edit, Glob, Grep, etc.)
        if (!toolName.startsWith("mcp__")) {
          return { behavior: "allow" as const };
        }

        // Auto-approve read-only MCP tools
        if (isReadOnlyMcpTool(toolName)) {
          debug(`Auto-approving read-only MCP tool: ${toolName}`);
          return { behavior: "allow" as const };
        }

        // Write MCP tool — ask user
        debug(`Requesting approval for write MCP tool: ${toolName}`);
        try {
          const approved = await callbacks!.onApprovalRequired!(toolName, input, options.toolUseID);
          if (approved) {
            debug(`User approved: ${toolName}`);
            return { behavior: "allow" as const };
          } else {
            debug(`User denied: ${toolName}`);
            return { behavior: "deny" as const, message: "User denied this action" };
          }
        } catch {
          debug(`Approval error/cancelled for: ${toolName}`);
          return { behavior: "deny" as const, message: "Approval cancelled" };
        }
      }
    : undefined;

  // Wrap with role-based restrictions (operators get path/command blocking)
  const canUseTool = buildCanUseTool(effectiveRole, baseMcpCanUseTool);

  // Determine permission mode:
  // - admin → always bypassPermissions (full trust, no prompts)
  // - operator → "default" + canUseTool (MCP approval + path/command blocking)
  // - viewer → restricted allowedTools, no canUseTool
  const useBypass = effectiveRole === "admin";
  const allowedTools = getAllowedToolsForRole(effectiveRole, agent.tools);

  debug(`Role: ${effectiveRole}, bypass: ${useBypass}, tools: ${allowedTools.length}`);

  const q = query({
    prompt,
    options: {
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
      },
      ...(useBypass
        ? { permissionMode: "bypassPermissions" as const, allowDangerouslySkipPermissions: true }
        : { permissionMode: "default" as const, ...(canUseTool ? { canUseTool } : {}) }),
      systemPrompt,
      maxBudgetUsd: isMainAgent ? 5.0 : 2.0,
      model: agent.model || undefined,
      mcpServers: getMcpServers(),
      ...(subagents ? { agents: subagents } : {}),
      allowedTools,
      includePartialMessages: true,
      debug: true,
      stderr: (data: string) => {
        stderrLines.push(data);
        debug(`[stderr] ${data.trim()}`);
      },
    },
  });

  try {
    for await (const message of q) {
      if (callbacks?.signal?.aborted) {
        debug("Aborted by signal");
        aborted = true;
        q.close();
        break;
      }

      debug(`Message type: ${message.type}${("subtype" in message) ? ` subtype: ${(message as { subtype?: string }).subtype}` : ""}`);

      if (message.type === "system" && "subtype" in message && message.subtype === "init") {
        sessionId = message.session_id;
        debug(`Session initialized: ${sessionId}`);
        callbacks?.onSessionInit?.(sessionId);
      }

      // Stream partial text tokens and real-time tool/thinking detection
      if (message.type === "stream_event" && "event" in message) {
        const event = message.event as {
          type: string;
          index?: number;
          delta?: { type: string; text?: string };
          content_block?: { type: string; name?: string };
        };

        // Real-time text streaming
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          callbacks?.onToken?.(event.delta.text);
        }

        // Real-time tool call start (fires as soon as the model starts a tool_use block)
        if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
          const toolName = event.content_block.name || "unknown";
          lastEmittedToolStart = toolName;
          debug(`  [stream] Tool use started: ${toolName}`);
          callbacks?.onToolCall?.(toolName, "start");
        }

        // Real-time thinking start
        if (event.type === "content_block_start" && event.content_block?.type === "thinking") {
          debug(`  [stream] Thinking started`);
          callbacks?.onThinking?.(true);
        }

        // Content block finished — end thinking/tool state
        if (event.type === "content_block_stop") {
          callbacks?.onThinking?.(false);
        }
      }

      // Collect full assistant messages and emit tool/thinking events
      if (message.type === "assistant" && "message" in message) {
        const msg = message.message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> ; stop_reason?: string; error?: unknown };
        debug(`Assistant message: stop_reason=${msg.stop_reason}, content_blocks=${msg.content?.length || 0}, error=${JSON.stringify(msg.error || null)}`);
        if (msg.content) {
          for (const block of msg.content) {
            const b = block as { type: string; text?: string; name?: string; input?: unknown; id?: string };
            debug(`  Block: type=${b.type}${b.name ? ` name=${b.name}` : ""}${b.text ? ` text=${b.text.slice(0, 200)}` : ""}`);
            if (b.type === "text" && b.text) {
              output += b.text;
            }
            // Emit tool call start from assistant messages as a fallback
            // (stream_events may not fire for subagent tool calls)
            if (b.type === "tool_use" && b.name) {
              // Serialize input and cap if huge (e.g., Write tool with large content)
              const inputStr = JSON.stringify(b.input);
              const cappedInput = inputStr.length > TOOL_RESULT_MAX_CHARS
                ? JSON.parse(JSON.stringify(b.input, (_k, v) =>
                    typeof v === "string" && v.length > 2000
                      ? v.slice(0, 2000) + `… [${v.length.toLocaleString()} chars]`
                      : v
                  ))
                : b.input;

              // Track the tool input for later pairing with result
              if (b.id) {
                pendingTools.set(b.id, { name: b.name, input: cappedInput });
              }
              // Skip if already emitted via stream_event for this exact tool
              if (lastEmittedToolStart === b.name) {
                lastEmittedToolStart = "";
              } else {
                callbacks?.onToolCall?.(b.name, "start", { input: cappedInput });
              }
            }
          }
        }
      }

      // Tool results (user messages with tool_result) signal tool calls ended
      if (message.type === "user" && "message" in message) {
        const userMsg = message.message as { content?: Array<{ type: string; tool_use_id?: string; content?: unknown }> };
        if (userMsg.content) {
          for (const block of userMsg.content) {
            if (block.type === "tool_result") {
              // Extract text from tool_result content
              let resultText = "";
              const rc = block.content;
              if (typeof rc === "string") {
                resultText = rc;
              } else if (Array.isArray(rc)) {
                resultText = (rc as Array<{ type: string; text?: string }>)
                  .filter((c) => c.type === "text" && c.text)
                  .map((c) => c.text)
                  .join("\n");
              }

              // Look up the pending tool to get its name and input
              const pending = block.tool_use_id ? pendingTools.get(block.tool_use_id) : undefined;
              const toolName = pending?.name || "";
              const toolInput = pending?.input;
              if (block.tool_use_id) pendingTools.delete(block.tool_use_id);

              // Truncate large results to keep SSE payloads manageable
              const truncated = resultText.length > TOOL_RESULT_MAX_CHARS;
              const cappedResult = truncated
                ? resultText.slice(0, TOOL_RESULT_MAX_CHARS) + `\n\n… [truncated — ${resultText.length.toLocaleString()} chars total]`
                : resultText;

              callbacks?.onToolCall?.(toolName, "end", {
                input: toolInput,
                result: cappedResult,
              });
            }
          }
        }
      }

      // Task progress from subagents
      if (message.type === "system" && "subtype" in message) {
        const sub = (message as { subtype?: string }).subtype;
        if (sub === "task_started") {
          callbacks?.onProgress?.("Subagent started");
        } else if (sub === "task_notification") {
          callbacks?.onProgress?.("Subagent completed");
        }
      }

      // Final result
      if (message.type === "result") {
        // Log the full result for debugging
        const resultJson = JSON.stringify(message, null, 2);
        debug(`Full result message:\n${resultJson.slice(0, 2000)}`);

        const result = message as {
          total_cost_usd: number;
          duration_ms: number;
          session_id: string;
          result?: string;
          is_error: boolean;
          subtype: string;
          errors?: string[];
        };
        costUsd = result.total_cost_usd;
        sessionId = result.session_id || sessionId;

        debug(`Result: subtype=${result.subtype}, cost=$${result.total_cost_usd}, is_error=${result.is_error}`);
        if (result.errors) {
          debug(`Errors: ${JSON.stringify(result.errors)}`);
        }

        // Check is_error regardless of subtype
        if (result.is_error) {
          const errMsg = result.errors?.join("; ") || result.result || `Agent ended with error (subtype: ${result.subtype})`;
          callbacks?.onError?.(errMsg);
          throw new Error(errMsg);
        }

        if (result.result) {
          output = result.result;
        }
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    debug(`Error caught: ${errMsg}`);
    if (stderrLines.length > 0) {
      debug(`Stderr output (last 20 lines):\n${stderrLines.slice(-20).join("\n")}`);
    }
    callbacks?.onError?.(errMsg);
    throw err;
  }

  const runResult: AgentRunResult = {
    output,
    costUsd,
    durationMs: Date.now() - startTime,
    sessionId,
    aborted,
  };

  debug(`Completed: cost=$${costUsd.toFixed(4)}, duration=${runResult.durationMs}ms, aborted=${aborted}`);
  callbacks?.onResult?.(runResult);
  return runResult;
}

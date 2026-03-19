/** Human-friendly descriptions for technical tool names, shared across all UI surfaces */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  Bash: "Runs a terminal command on the system",
  Glob: "Searches for files by name or pattern",
  Grep: "Searches inside files for specific text",
  Read: "Reads the contents of a file",
  Write: "Creates or overwrites a file",
  Edit: "Makes targeted edits to a file",
  WebSearch: "Searches the web for information",
  WebFetch: "Fetches content from a web page",
  Agent: "Delegates a task to a specialized sub-agent",
  Task: "Manages background tasks",
  NotebookEdit: "Edits a Jupyter notebook cell",
  AskUserQuestion: "Asks you a question before continuing",
  TodoWrite: "Updates the to-do list",
  Mcp: "Calls an external integration tool",
  ListMcpResources: "Lists available integration resources",
  ReadMcpResource: "Reads data from an integration resource",
};

export function getToolDescription(name: string): string | undefined {
  if (TOOL_DESCRIPTIONS[name]) return TOOL_DESCRIPTIONS[name];
  if (name.startsWith("mcp__")) {
    const parts = name.replace(/^mcp__/, "").split("__");
    const service = (parts[0] || "").replace(/^claude_ai_/, "");
    return `Action provided by the ${service} integration`;
  }
  return undefined;
}

import { NextResponse } from "next/server";
import { readSkills } from "@/lib/capabilities";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, "../../../../..");
const MCP_PATH = path.join(PROJECT_ROOT, ".mcp.json");

interface ToolOption {
  name: string;
  category: "builtin" | "mcp" | "skill";
  description?: string;
}

const BUILTIN_TOOLS: ToolOption[] = [
  { name: "Read", category: "builtin", description: "Read files from the filesystem" },
  { name: "Write", category: "builtin", description: "Write/create files" },
  { name: "Edit", category: "builtin", description: "Edit existing files" },
  { name: "Bash", category: "builtin", description: "Execute shell commands" },
  { name: "Glob", category: "builtin", description: "Find files by pattern" },
  { name: "Grep", category: "builtin", description: "Search file contents" },
  { name: "WebSearch", category: "builtin", description: "Search the web" },
  { name: "WebFetch", category: "builtin", description: "Fetch web page content" },
  { name: "Agent", category: "builtin", description: "Delegate to subagents" },
];

export async function GET() {
  const tools: ToolOption[] = [...BUILTIN_TOOLS];

  // MCP servers
  try {
    const raw = JSON.parse(fs.readFileSync(MCP_PATH, "utf-8"));
    const servers = raw.mcpServers || {};
    for (const name of Object.keys(servers)) {
      tools.push({
        name: `mcp:${name}`,
        category: "mcp",
        description: `MCP server: ${name}`,
      });
    }
  } catch {
    // no MCP config
  }

  // Anthropic-hosted integrations
  for (const name of ["Gmail", "Linear", "Canva", "ClickUp"]) {
    tools.push({
      name: `hosted:${name}`,
      category: "mcp",
      description: `Anthropic-hosted integration: ${name}`,
    });
  }

  // Skills
  const skills = readSkills();
  for (const skill of skills) {
    tools.push({
      name: `skill:${skill.slug}`,
      category: "skill",
      description: skill.description,
    });
  }

  return NextResponse.json(tools);
}

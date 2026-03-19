import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { AgentMeta } from "./types";

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, "../../../..");
const AGENTS_DIR = path.join(PROJECT_ROOT, ".claude", "agents");

// The main assistant — uses CLAUDE.md as its prompt, all other agents as subagents
const MAIN_AGENT: AgentMeta = {
  slug: "main",
  name: "My Assistant",
  description: "Your personal AI assistant with full access to all tools, MCP servers, and specialist subagents.",
  tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Agent", "Mcp", "Task", "NotebookEdit", "AskUserQuestion"],
  color: "#8B5CF6",
  emoji: "⚡",
  vibe: "Handles everything or knows who can.",
  filePath: "",
};

let cache: { agents: AgentMeta[]; timestamp: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds

export function getAgents(): AgentMeta[] {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.agents;
  }

  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));

  const agents: AgentMeta[] = files.map((file) => {
    const filePath = path.join(AGENTS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);

    const slug = path.basename(file, ".md");
    const tools = data.tools
      ? String(data.tools)
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
      : [];

    const mcpServers = data.mcpServers
      ? String(data.mcpServers)
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : undefined;

    return {
      slug,
      name: data.name || slug,
      description: data.description || "",
      tools,
      mcpServers,
      color: data.color,
      emoji: data.emoji,
      vibe: data.vibe,
      model: data.model,
      filePath,
    };
  });

  // Main assistant always comes first
  const all = [MAIN_AGENT, ...agents];
  cache = { agents: all, timestamp: Date.now() };
  return all;
}

export function getAgent(slug: string): AgentMeta | undefined {
  return getAgents().find((a) => a.slug === slug);
}

export function clearAgentCache(): void {
  cache = null;
}

export function updateAgentMeta(
  slug: string,
  updates: Partial<Pick<AgentMeta, "name" | "description" | "emoji" | "vibe" | "tools" | "mcpServers">>
): AgentMeta | null {
  if (slug === "main") return null; // Main agent is not file-backed

  const filePath = path.join(AGENTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.emoji !== undefined) data.emoji = updates.emoji;
  if (updates.vibe !== undefined) data.vibe = updates.vibe;
  if (updates.tools !== undefined) data.tools = updates.tools.join(", ");
  if (updates.mcpServers !== undefined) {
    if (updates.mcpServers.length > 0) {
      data.mcpServers = updates.mcpServers.join(", ");
    } else {
      delete data.mcpServers;
    }
  }

  const updated = matter.stringify(content, data);
  fs.writeFileSync(filePath, updated, "utf-8");

  // Bust cache so next read picks up changes
  cache = null;

  return getAgent(slug) || null;
}

export function getAgentContent(slug: string): string {
  if (slug === "main") return ""; // Main agent uses CLAUDE.md directly
  const filePath = path.join(AGENTS_DIR, `${slug}.md`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { content } = matter(raw);
  return content.trim();
}

export function createAgent(meta: {
  name: string;
  description: string;
  tools?: string;
  mcpServers?: string;
  color?: string;
  emoji?: string;
  vibe?: string;
  model?: string;
  content: string;
}): AgentMeta {
  // Generate slug from name
  const slug = meta.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const filePath = path.join(AGENTS_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Agent "${slug}" already exists`);
  }

  const frontmatter: Record<string, string> = {
    name: meta.name,
    description: meta.description,
  };
  if (meta.tools) frontmatter.tools = meta.tools;
  if (meta.mcpServers) frontmatter.mcpServers = meta.mcpServers;
  if (meta.color) frontmatter.color = meta.color;
  if (meta.emoji) frontmatter.emoji = meta.emoji;
  if (meta.vibe) frontmatter.vibe = meta.vibe;
  if (meta.model) frontmatter.model = meta.model;

  const fileContent = matter.stringify(meta.content, frontmatter);
  fs.writeFileSync(filePath, fileContent, "utf-8");

  cache = null;
  return getAgent(slug)!;
}

export function deleteAgent(slug: string): boolean {
  if (slug === "main") return false;
  const filePath = path.join(AGENTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  cache = null;
  return true;
}

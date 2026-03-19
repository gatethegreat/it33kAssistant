import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { getAgents } from "./agents";

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, "../../../..");
const SKILLS_DIR = path.join(PROJECT_ROOT, ".claude", "skills");
const COMMANDS_DIR = path.join(PROJECT_ROOT, ".claude", "commands");
const MCP_PATH = path.join(PROJECT_ROOT, ".mcp.json");

export interface SkillInfo {
  slug: string;
  name: string;
  description: string;
  category: string;
}

export interface CommandInfo {
  slug: string;
  name: string;
  description: string;
  group?: string; // e.g., "consider" for consider/* commands
}

export interface McpServerInfo {
  name: string;
  type: "local" | "remote";
}

export interface SubagentInfo {
  slug: string;
  name: string;
  description: string;
  emoji?: string;
}

export interface AgentCapabilities {
  skills: SkillInfo[];
  commands: CommandInfo[];
  mcpServers: McpServerInfo[];
  subagents: SubagentInfo[];
  tools: string[];
}

function categorizeSkill(slug: string): string {
  if (slug.startsWith("gws-workflow")) return "Workflows";
  if (slug.startsWith("gws-")) return "Google Workspace";
  if (slug.startsWith("recipe-")) return "Recipes";
  if (slug.startsWith("persona-")) return "Personas";
  if (slug.includes("frontend") || slug.includes("design")) return "Development";
  return "Other";
}

export function readSkillContent(slug: string): string | null {
  try {
    const skillFile = path.join(SKILLS_DIR, slug, "SKILL.md");
    const raw = fs.readFileSync(skillFile, "utf-8");
    const { content } = matter(raw);
    return content.trim() || null;
  } catch {
    return null;
  }
}

export function readSkills(): SkillInfo[] {
  try {
    const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    return dirs.map((dir) => {
      const skillFile = path.join(SKILLS_DIR, dir.name, "SKILL.md");
      try {
        const raw = fs.readFileSync(skillFile, "utf-8");
        const { data } = matter(raw);
        return {
          slug: dir.name,
          name: data.name || dir.name,
          description: data.description || "",
          category: categorizeSkill(dir.name),
        };
      } catch {
        return {
          slug: dir.name,
          name: dir.name,
          description: "",
          category: categorizeSkill(dir.name),
        };
      }
    }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function readCommands(): CommandInfo[] {
  try {
    const commands: CommandInfo[] = [];
    const entries = fs.readdirSync(COMMANDS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const raw = fs.readFileSync(path.join(COMMANDS_DIR, entry.name), "utf-8");
        const { data } = matter(raw);
        const slug = entry.name.replace(/\.md$/, "");
        commands.push({
          slug,
          name: data.name || slug,
          description: data.description || "",
        });
      } else if (entry.isDirectory()) {
        // Grouped commands like consider/*
        const subDir = path.join(COMMANDS_DIR, entry.name);
        const subFiles = fs.readdirSync(subDir).filter((f) => f.endsWith(".md"));
        for (const sub of subFiles) {
          const raw = fs.readFileSync(path.join(subDir, sub), "utf-8");
          const { data } = matter(raw);
          const slug = `${entry.name}/${sub.replace(/\.md$/, "")}`;
          commands.push({
            slug,
            name: data.name || sub.replace(/\.md$/, ""),
            description: data.description || "",
            group: entry.name,
          });
        }
      }
    }

    return commands.sort((a, b) => (a.group || "").localeCompare(b.group || "") || a.slug.localeCompare(b.slug));
  } catch {
    return [];
  }
}

function readMcpServers(): McpServerInfo[] {
  try {
    const raw = JSON.parse(fs.readFileSync(MCP_PATH, "utf-8"));
    const servers = raw.mcpServers || {};
    return Object.keys(servers).map((name) => ({
      name,
      type: servers[name].type === "http" ? "remote" as const : "local" as const,
    }));
  } catch {
    return [];
  }
}

function getSubagents(excludeSlug?: string): SubagentInfo[] {
  return getAgents()
    .filter((a) => a.slug !== "main" && a.slug !== excludeSlug)
    .map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      emoji: a.emoji,
    }));
}

// Anthropic-hosted MCP integrations (add your own here)
const HOSTED_INTEGRATIONS: McpServerInfo[] = [];

export function getAgentCapabilities(slug: string): AgentCapabilities {
  const isMain = slug === "main";
  const agents = getAgents();
  const agent = agents.find((a) => a.slug === slug);
  const tools = agent?.tools || [];

  if (isMain) {
    return {
      skills: readSkills(),
      commands: readCommands(),
      mcpServers: [...readMcpServers(), ...HOSTED_INTEGRATIONS],
      subagents: getSubagents(),
      tools,
    };
  }

  // Specialist agents: only show MCP servers they've been granted access to
  const allMcp = [...readMcpServers(), ...HOSTED_INTEGRATIONS];
  const agentMcpNames = agent?.mcpServers;
  const filteredMcp = agentMcpNames
    ? allMcp.filter((s) => agentMcpNames.includes(s.name))
    : [];

  return {
    skills: [],
    commands: [],
    mcpServers: filteredMcp,
    subagents: [],
    tools,
  };
}

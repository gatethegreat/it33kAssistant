import { Worker, Queue } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import path from "path";

// Load env from .env.local if available
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, "../..");
const QUEUE_NAME = "agent-runs";

function getRedisConfig() {
  const url = new URL(REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

const connection = getRedisConfig();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Dynamic import for ESM compatibility with agent SDK
async function loadAgentRunner() {
  // We need to load agents and execute them
  const fs = await import("fs");
  const matter = (await import("gray-matter")).default;

  const agentsDir = path.join(PROJECT_ROOT, ".claude", "agents");

  function getAgentMeta(slug: string) {
    if (slug === "main") {
      return {
        slug: "main",
        name: "My Assistant",
        description: "Personal AI assistant with full access to all tools and subagents.",
        tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Agent"],
        model: undefined,
        filePath: "",
      };
    }
    const filePath = path.join(agentsDir, `${slug}.md`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    return {
      slug,
      name: data.name || slug,
      description: data.description || "",
      tools: data.tools ? String(data.tools).split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      color: data.color,
      emoji: data.emoji,
      vibe: data.vibe,
      model: data.model,
      filePath,
    };
  }

  function getProjectInstructions(): string {
    try {
      return fs.readFileSync(path.join(PROJECT_ROOT, "CLAUDE.md"), "utf-8").trim();
    } catch { return ""; }
  }

  function getAgentSystemPrompt(slug: string): string {
    const projectInstructions = getProjectInstructions();
    if (slug === "main") return projectInstructions;
    const filePath = path.join(agentsDir, `${slug}.md`);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { content } = matter(raw);
    return [projectInstructions, content.trim()].filter(Boolean).join("\n\n---\n\n");
  }

  function getSubagentDefinitions(): Record<string, { description: string; prompt: string; tools: string[] }> {
    const defs: Record<string, { description: string; prompt: string; tools: string[] }> = {};
    const files = fs.readdirSync(agentsDir).filter((f: string) => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(agentsDir, file);
      const raw = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);
      const slug = path.basename(file, ".md");
      const tools = data.tools ? String(data.tools).split(",").map((t: string) => t.trim()).filter(Boolean) : ["Read", "Write", "Edit", "Bash", "Glob", "Grep"];
      defs[slug] = { description: data.description || slug, prompt: content.trim(), tools };
    }
    return defs;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getMcpServers(): Record<string, any> {
    try {
      const mcpPath = path.join(PROJECT_ROOT, ".mcp.json");
      const raw = JSON.parse(fs.readFileSync(mcpPath, "utf-8"));
      return raw.mcpServers || {};
    } catch { return {}; }
  }

  function getSkillContent(slug: string): string | null {
    try {
      const skillFile = path.join(PROJECT_ROOT, ".claude", "skills", slug, "SKILL.md");
      if (!fs.existsSync(skillFile)) return null;
      const raw = fs.readFileSync(skillFile, "utf-8");
      const { content } = matter(raw);
      return content.trim() || null;
    } catch {
      return null;
    }
  }

  return { getAgentMeta, getAgentSystemPrompt, getSubagentDefinitions, getMcpServers, getSkillContent };
}

async function main() {
  const { getAgentMeta, getAgentSystemPrompt, getSubagentDefinitions, getMcpServers, getSkillContent } = await loadAgentRunner();
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  // Sync schedules from Supabase to BullMQ on startup
  const queue = new Queue(QUEUE_NAME, { connection });

  const { data: schedules } = await supabase
    .from("agent_schedules")
    .select("*")
    .eq("enabled", true);

  if (schedules) {
    for (const schedule of schedules) {
      await queue.upsertJobScheduler(
        `schedule-${schedule.id}`,
        { pattern: schedule.cron },
        {
          name: "scheduled-agent-run",
          data: {
            scheduleId: schedule.id,
            agentSlug: schedule.agent_slug,
            agentName: schedule.agent_name,
            prompt: schedule.prompt,
            skillSlug: schedule.skill_slug || undefined,
          },
        }
      );
      console.log(`[worker] Registered scheduler: schedule-${schedule.id} (${schedule.cron})`);
    }
  }

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { scheduleId, agentSlug, agentName, prompt, skillSlug } = job.data;
      console.log(`[worker] Processing job ${job.id}: agent=${agentSlug}`);

      const agent = getAgentMeta(agentSlug);
      if (!agent) {
        throw new Error(`Agent ${agentSlug} not found`);
      }

      // Create a run record in Supabase
      const { data: run, error: insertError } = await supabase
        .from("agent_runs")
        .insert({
          agent_slug: agentSlug,
          agent_name: agentName,
          prompt,
          status: "running",
          schedule_id: scheduleId || null,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError || !run) {
        throw new Error(`Failed to create run record: ${insertError?.message}`);
      }

      const startTime = Date.now();
      let output = "";
      let sessionId = "";
      let costUsd = 0;

      try {
        const isMainAgent = agentSlug === "main";
        const mcpServers = getMcpServers();
        let systemPrompt = getAgentSystemPrompt(agentSlug);

        // Inject skill content into system prompt if a skill is specified
        if (skillSlug) {
          const skillContent = getSkillContent(skillSlug);
          if (skillContent) {
            systemPrompt = [systemPrompt, `## Active Skill: ${skillSlug}\n\n${skillContent}`]
              .filter(Boolean).join("\n\n---\n\n");
          }
        }
        const subagents = isMainAgent ? getSubagentDefinitions() : undefined;

        const q = query({
          prompt,
          options: {
            cwd: PROJECT_ROOT,
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            systemPrompt,
            maxBudgetUsd: isMainAgent ? 5.0 : 2.0,
            model: agent.model || undefined,
            mcpServers,
            ...(subagents ? { agents: subagents, allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Agent"] } : {}),
            env: {
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
            },
          },
        });

        for await (const message of q) {
          if (message.type === "system" && "subtype" in message && message.subtype === "init") {
            sessionId = message.session_id;
          }

          if (message.type === "result") {
            const result = message as {
              total_cost_usd: number;
              session_id: string;
              result?: string;
              subtype: string;
              errors?: string[];
            };
            costUsd = result.total_cost_usd;
            sessionId = result.session_id || sessionId;

            if (result.subtype !== "success") {
              throw new Error(result.errors?.join("; ") || `Agent ended with ${result.subtype}`);
            }
            if (result.result) {
              output = result.result;
            }
          }
        }

        const durationMs = Date.now() - startTime;

        await supabase
          .from("agent_runs")
          .update({
            status: "completed",
            output,
            cost_usd: costUsd,
            duration_ms: durationMs,
            session_id: sessionId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        // Update schedule last_run_at
        if (scheduleId) {
          await supabase
            .from("agent_schedules")
            .update({ last_run_at: new Date().toISOString() })
            .eq("id", scheduleId);
        }

        // Create notification
        const contentSkills = ["create-blog-post", "create-linkedin-post", "create-post-designs", "publish-wordpress"];
        const notifType = skillSlug && contentSkills.includes(skillSlug) ? "needs_review" : "completed";
        await supabase.from("notifications").insert({
          run_id: run.id,
          schedule_id: scheduleId || null,
          agent_slug: agentSlug,
          session_id: sessionId || null,
          type: notifType,
          title: `${agentName}: ${notifType === "needs_review" ? "Ready for review" : "Completed"}`,
          summary: output ? output.slice(0, 200) : null,
        });

        console.log(`[worker] Job ${job.id} completed: cost=$${costUsd.toFixed(4)}, duration=${durationMs}ms`);
        return { runId: run.id, costUsd, durationMs };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        await supabase
          .from("agent_runs")
          .update({
            status: "failed",
            error: errorMsg,
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        // Create failure notification
        await supabase.from("notifications").insert({
          run_id: run.id,
          schedule_id: scheduleId || null,
          agent_slug: agentSlug,
          session_id: sessionId || null,
          type: "failed",
          title: `${agentName}: Failed`,
          summary: errorMsg.slice(0, 200),
        });

        console.error(`[worker] Job ${job.id} failed: ${errorMsg}`);
        throw err;
      }
    },
    {
      connection,
      concurrency: 2,
      lockDuration: 600_000, // 10 min for long-running agents
      stalledInterval: 600_000,
      maxStalledCount: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] Job ${job?.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[worker] Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("[worker] Worker error:", error);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[worker] Shutting down...");
    await worker.close();
    await queue.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`[worker] Started. Listening on queue: ${QUEUE_NAME}`);
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});

#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const prompts = require("prompts");

const BLUE = "\x1b[34m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

const log = (msg) => console.log(`${GREEN}[✓]${NC} ${msg}`);
const info = (msg) => console.log(`${BLUE}[→]${NC} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}[!]${NC} ${msg}`);
const err = (msg) => console.log(`${RED}[✗]${NC} ${msg}`);

const TEMPLATES_DIR = path.join(__dirname, "templates");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyIfNotExists(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function copyDirAdditive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  let added = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        copyDir(srcPath, destPath);
        added++;
      }
    } else {
      if (copyIfNotExists(srcPath, destPath)) added++;
    }
  }
  return added;
}

function mergeJsonFile(srcPath, destPath, mergeFn) {
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
    return;
  }
  const existing = JSON.parse(fs.readFileSync(destPath, "utf8"));
  const ours = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  const merged = mergeFn(existing, ours);
  fs.writeFileSync(destPath, JSON.stringify(merged, null, 2) + "\n");
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: "inherit", ...opts });
  } catch {
    return null;
  }
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("");
  console.log(`${BLUE}╔══════════════════════════════════════════════════╗${NC}`);
  console.log(`${BLUE}║       Claude Code Visualizer — Setup        ║${NC}`);
  console.log(`${BLUE}╚══════════════════════════════════════════════════╝${NC}`);
  console.log("");

  // Determine project directory from CLI arg or prompt
  let projectDir = process.argv[2];

  if (!projectDir) {
    const res = await prompts({
      type: "text",
      name: "dir",
      message: "Project directory",
      initial: "my-claude-visualizer",
    });
    if (!res.dir) process.exit(0);
    projectDir = res.dir;
  }

  const projectRoot = path.resolve(projectDir);
  const isExisting = fs.existsSync(projectRoot) && fs.existsSync(path.join(projectRoot, ".claude"));
  const appDir = path.join(projectRoot, "personal-assistant-app");

  if (isExisting) {
    info(`Detected existing .claude/ project at ${projectRoot}`);
    info("Will merge additively — your existing files always win.");
  } else {
    info(`Creating new project at ${projectRoot}`);
  }
  console.log("");

  // -----------------------------------------------------------------
  // Credentials
  // -----------------------------------------------------------------

  const creds = await prompts([
    {
      type: "password",
      name: "anthropicKey",
      message: "Anthropic API key (sk-ant-...)",
      validate: (v) => v.startsWith("sk-ant-") || "Key should start with sk-ant-",
    },
    {
      type: "text",
      name: "supabaseUrl",
      message: "Supabase project URL (https://xyz.supabase.co)",
    },
    {
      type: "password",
      name: "supabaseAnonKey",
      message: "Supabase anon key",
    },
  ]);

  if (!creds.anthropicKey) process.exit(0);

  // -----------------------------------------------------------------
  // Copy the app
  // -----------------------------------------------------------------

  info("Setting up project files...");

  fs.mkdirSync(projectRoot, { recursive: true });

  // Copy personal-assistant-app (the Next.js UI)
  const appTemplate = path.join(TEMPLATES_DIR, "app");
  if (fs.existsSync(appDir)) {
    warn("personal-assistant-app/ already exists — updating...");
  }
  copyDir(appTemplate, appDir);
  log("personal-assistant-app/ installed");

  // -----------------------------------------------------------------
  // Set up .claude/ (agents, commands, skills, hooks, settings)
  // -----------------------------------------------------------------

  const srcClaude = path.join(TEMPLATES_DIR, "claude");
  const dstClaude = path.join(projectRoot, ".claude");

  // Agents
  const addedAgents = copyDirAdditive(
    path.join(srcClaude, "agents"),
    path.join(dstClaude, "agents")
  );
  log(`Agents: added ${addedAgents} new`);

  // Commands
  const addedCommands = copyDirAdditive(
    path.join(srcClaude, "commands"),
    path.join(dstClaude, "commands")
  );
  log(`Commands: added ${addedCommands} new`);

  // Skills
  const addedSkills = copyDirAdditive(
    path.join(srcClaude, "skills"),
    path.join(dstClaude, "skills")
  );
  log(`Skills: added ${addedSkills} new`);

  // Hooks
  fs.mkdirSync(path.join(dstClaude, "hooks"), { recursive: true });
  let addedHooks = 0;
  for (const hook of fs.readdirSync(path.join(srcClaude, "hooks"))) {
    const src = path.join(srcClaude, "hooks", hook);
    const dest = path.join(dstClaude, "hooks", hook);
    if (copyIfNotExists(src, dest)) {
      try { fs.chmodSync(dest, 0o755); } catch {}
      addedHooks++;
    }
  }
  log(`Hooks: added ${addedHooks} new`);

  // settings.local.json — merge hooks config
  mergeJsonFile(
    path.join(srcClaude, "settings.local.json"),
    path.join(dstClaude, "settings.local.json"),
    (existing, ours) => {
      // Merge hooks: add our hook events if they don't already exist
      const mergedHooks = { ...(ours.hooks || {}) };
      for (const [event, hooks] of Object.entries(existing.hooks || {})) {
        mergedHooks[event] = hooks; // existing wins
      }
      return {
        ...existing,
        enableAllProjectMcpServers:
          existing.enableAllProjectMcpServers ?? ours.enableAllProjectMcpServers,
        hooks: mergedHooks,
      };
    }
  );
  log("settings.local.json configured");

  // .mcp.json — merge servers
  mergeJsonFile(
    path.join(TEMPLATES_DIR, "mcp.json"),
    path.join(projectRoot, ".mcp.json"),
    (existing, ours) => ({
      mcpServers: { ...(ours.mcpServers || {}), ...(existing.mcpServers || {}) },
    })
  );
  log(".mcp.json configured");

  // CLAUDE.md
  const claudeMdDest = path.join(projectRoot, "CLAUDE.md");
  if (copyIfNotExists(path.join(TEMPLATES_DIR, "CLAUDE.md"), claudeMdDest)) {
    log("CLAUDE.md created");
  } else {
    log("CLAUDE.md exists — keeping yours");
  }

  // -----------------------------------------------------------------
  // Write .env.local
  // -----------------------------------------------------------------

  const envContent = `# Generated by create-personalai — ${new Date().toISOString()}
ANTHROPIC_API_KEY=${creds.anthropicKey}
NEXT_PUBLIC_SUPABASE_URL=${creds.supabaseUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${creds.supabaseAnonKey}
SUPABASE_URL=${creds.supabaseUrl}
SUPABASE_ANON_KEY=${creds.supabaseAnonKey}
REDIS_URL=redis://localhost:6379
PROJECT_ROOT=${projectRoot}
`;

  fs.writeFileSync(path.join(appDir, ".env.local"), envContent, { mode: 0o600 });
  log(".env.local created");

  // Add Supabase MCP server if we have a URL
  const supabaseMatch = (creds.supabaseUrl || "").match(
    /https:\/\/([^.]+)\.supabase\.co/
  );
  if (supabaseMatch) {
    const ref = supabaseMatch[1];
    const mcpPath = path.join(projectRoot, ".mcp.json");
    const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    mcp.mcpServers.supabase = {
      type: "http",
      url: `https://mcp.supabase.com/mcp?project_ref=${ref}`,
    };
    fs.writeFileSync(mcpPath, JSON.stringify(mcp, null, 2) + "\n");
    log("Supabase MCP server added");
  }

  // -----------------------------------------------------------------
  // npm install
  // -----------------------------------------------------------------

  info("Installing dependencies...");
  run("npm install", { cwd: appDir });
  log("Dependencies installed");

  // -----------------------------------------------------------------
  // Google Workspace (optional)
  // -----------------------------------------------------------------

  console.log("");
  const { setupGws } = await prompts({
    type: "confirm",
    name: "setupGws",
    message: "Set up Google Workspace integration? (Gmail, Calendar, Drive, etc.)",
    initial: false,
  });

  if (setupGws) {
    console.log("");
    info("Installing Google Workspace CLI...");
    run("npm install @anthropic-ai/claude-code-google-workspace", { cwd: projectRoot });

    // Check if gws auth is needed
    const hasAuth = runCapture("npx gws auth status");
    if (!hasAuth) {
      console.log("");
      const { gwsAuth } = await prompts({
        type: "select",
        name: "gwsAuth",
        message: "Google Workspace authentication",
        choices: [
          { title: "Full setup (creates GCP project + OAuth)", value: "setup" },
          { title: "Login only (you already have OAuth configured)", value: "login" },
          { title: "Skip for now", value: "skip" },
        ],
      });

      if (gwsAuth === "setup") {
        run("npx gws auth setup --login", { cwd: projectRoot });
      } else if (gwsAuth === "login") {
        run("npx gws auth login", { cwd: projectRoot });
      } else {
        info("Skipping auth. Run later: npx gws auth setup --login");
      }
    } else {
      log("Already authenticated with Google Workspace");
    }

    // Install GWS skills
    console.log("");
    const { installSkills } = await prompts({
      type: "confirm",
      name: "installSkills",
      message: "Install Google Workspace skills? (lets agents use Gmail, Calendar, etc.)",
      initial: true,
    });

    if (installSkills) {
      run("npx skills add https://github.com/googleworkspace/cli", { cwd: projectRoot });
    }

    // Add gws permission to settings
    const settingsPath = path.join(dstClaude, "settings.local.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (!JSON.stringify(settings).includes("npx gws")) {
      settings.permissions = settings.permissions || {};
      settings.permissions.allow = settings.permissions.allow || [];
      settings.permissions.allow.push("Bash(npx gws:*)");
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
      log("Added gws permission to settings");
    }

    log("Google Workspace setup complete");
  }

  // -----------------------------------------------------------------
  // Done
  // -----------------------------------------------------------------

  console.log("");
  console.log(`${GREEN}╔══════════════════════════════════════════════════╗${NC}`);
  console.log(`${GREEN}║           Setup Complete!                        ║${NC}`);
  console.log(`${GREEN}╚══════════════════════════════════════════════════╝${NC}`);
  console.log("");

  log(`Project created at: ${projectRoot}`);
  console.log("");
  info("To get started:");
  console.log("");
  console.log(`  cd ${projectDir}/personal-assistant-app`);
  console.log("  redis-server &           # Start Redis (needed for job queue)");
  console.log("  npm run dev:all          # Start the app + worker");
  console.log("");
  info("Then open http://localhost:3000");
  console.log("");

  if (!setupGws) {
    info("To add Google Workspace later:");
    console.log(`  cd ${projectDir}`);
    console.log("  npm install @anthropic-ai/claude-code-google-workspace");
    console.log("  npx gws auth setup --login");
    console.log("  npx skills add https://github.com/googleworkspace/cli");
    console.log("");
  }
}

main().catch((e) => {
  err(e.message);
  process.exit(1);
});

#!/usr/bin/env node

const { execSync, spawnSync } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: "inherit", ...opts });
}

function checkGwsAuth() {
  try {
    const result = execSync("npx gws auth status 2>&1", {
      encoding: "utf-8",
      timeout: 15000,
    });
    return result.includes("Logged in") || result.includes("authenticated");
  } catch {
    return false;
  }
}

async function main() {
  console.log("");
  console.log("┌─────────────────────────────────────────┐");
  console.log("│   Personal AI Assistant — Setup Wizard   │");
  console.log("└─────────────────────────────────────────┘");
  console.log("");

  // Step 1: Check Google Workspace auth
  console.log("[1/2] Checking Google Workspace authentication...");
  console.log("");

  const isAuthed = checkGwsAuth();

  if (isAuthed) {
    console.log("  Google Workspace: already authenticated");
    console.log("");
  } else {
    console.log("  Google Workspace needs to be connected.");
    console.log("  This opens a browser window for Google sign-in.");
    console.log("  The assistant uses this to access your Gmail, Calendar, Drive, etc.");
    console.log("");

    const answer = await ask("  Set up Google Workspace now? (Y/n) ");

    if (answer.toLowerCase() !== "n") {
      console.log("");
      console.log("  Opening Google sign-in...");
      console.log("");
      run("npx gws auth setup --login");
      console.log("");
    } else {
      console.log("");
      console.log("  Skipped. Run 'npx gws auth setup --login' later to connect.");
      console.log("");
    }
  }

  // Step 2: Done
  console.log("[2/2] Setup complete!");
  console.log("");
  console.log("  To start using your assistant:");
  console.log("");
  console.log("    claude");
  console.log("");
  console.log("  Try asking:");
  console.log('    "What\'s on my calendar today?"');
  console.log('    "Show me my unread emails"');
  console.log('    "Find the latest doc in my Drive"');
  console.log("");

  rl.close();
}

main().catch((err) => {
  console.error("Setup error:", err.message);
  rl.close();
  process.exit(1);
});

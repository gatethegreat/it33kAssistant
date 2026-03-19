#!/usr/bin/env node

/**
 * Copies templates from the main repo into create-personalai/templates/
 * Run this before `npm publish` (wired up as prepublishOnly script).
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEST = path.join(__dirname, "templates");

function copyDir(src, dest, exclude = []) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

// 1. Copy personal-assistant-app → templates/app (excluding templates/ and node_modules/)
console.log("Copying personal-assistant-app → templates/app ...");
copyDir(
  path.join(ROOT, "personal-assistant-app"),
  path.join(DEST, "app"),
  ["templates", "node_modules", ".next", ".env.local"]
);

// 2. Copy templates/claude → templates/claude
console.log("Copying .claude templates → templates/claude ...");
copyDir(
  path.join(ROOT, "personal-assistant-app", "templates", "claude"),
  path.join(DEST, "claude")
);

// 3. Copy templates/mcp.json → templates/mcp.json
console.log("Copying mcp.json template ...");
fs.copyFileSync(
  path.join(ROOT, "personal-assistant-app", "templates", "mcp.json"),
  path.join(DEST, "mcp.json")
);

// 4. Copy templates/CLAUDE.md → templates/CLAUDE.md
console.log("Copying CLAUDE.md template ...");
fs.copyFileSync(
  path.join(ROOT, "personal-assistant-app", "templates", "CLAUDE.md"),
  path.join(DEST, "CLAUDE.md")
);

console.log("Done — templates/ is ready for publish.");

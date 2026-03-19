import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Key manifest — the keys this app cares about
// ---------------------------------------------------------------------------

interface KeyDef {
  name: string;
  category: "core" | "auth";
  optional: boolean;
  /** Which .env file this key lives in (relative to PROJECT_ROOT) */
  envFile: string;
  /** Validation description shown in UI */
  validationHint: string;
}

const KEY_MANIFEST: KeyDef[] = [
  {
    name: "ANTHROPIC_API_KEY",
    category: "core",
    optional: false,
    envFile: "personal-assistant-app/.env.local",
    validationHint: "Tested against Anthropic API",
  },
  {
    name: "GEMINI_API_KEY",
    category: "core",
    optional: false,
    envFile: "personal-assistant-app/.env.local",
    validationHint: "Tested against Gemini API",
  },
  {
    name: "SUPABASE_URL",
    category: "core",
    optional: false,
    envFile: "personal-assistant-app/.env.local",
    validationHint: "Must be a valid URL",
  },
  {
    name: "SUPABASE_ANON_KEY",
    category: "core",
    optional: false,
    envFile: "personal-assistant-app/.env.local",
    validationHint: "JWT format (eyJ...)",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    category: "auth",
    optional: true,
    envFile: "personal-assistant-app/.env.local",
    validationHint: "OAuth client ID",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    category: "auth",
    optional: true,
    envFile: "personal-assistant-app/.env.local",
    validationHint: "OAuth client secret",
  },
];

const PROJECT_ROOT = process.env.PROJECT_ROOT || "/mnt/c/Users/Admin/Documents/PersonalAIssistant";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskValue(value: string): string {
  if (value.length <= 8) return "••••••••";
  return "••••••••" + value.slice(-4);
}

type Source = "env-file" | "process" | "missing";

function detectSource(name: string, envFile: string): { source: Source; value: string } {
  // Check .env file first
  const envPath = path.join(PROJECT_ROOT, envFile);
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const regex = new RegExp(`^${name}=(.*)$`, "m");
    const match = content.match(regex);
    if (match && match[1].trim()) {
      return { source: "env-file", value: match[1].trim() };
    }
  } catch { /* file doesn't exist */ }

  // Check process.env
  if (process.env[name]) {
    return { source: "process", value: process.env[name]! };
  }

  return { source: "missing", value: "" };
}

async function validateKey(name: string, value: string): Promise<{ valid: boolean; error?: string }> {
  if (!value) return { valid: false, error: "Empty value" };

  switch (name) {
    case "ANTHROPIC_API_KEY": {
      try {
        // Make a real API call — /v1/models doesn't check credit balance, so a "stuck" key looks valid there
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": value,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "." }],
          }),
        });
        if (res.ok) return { valid: true };
        if (res.status === 401) return { valid: false, error: "Invalid API key" };
        const body = await res.text();
        if (body.includes("credit balance")) {
          return { valid: false, error: "Key stuck — Anthropic cached a zero balance on this key. Generate a new one at console.anthropic.com/settings/keys" };
        }
        return { valid: false, error: `API returned ${res.status}` };
      } catch (e) {
        return { valid: false, error: `Connection failed: ${(e as Error).message}` };
      }
    }

    case "GEMINI_API_KEY": {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${value}`
        );
        if (res.ok) return { valid: true };
        if (res.status === 400 || res.status === 403) return { valid: false, error: "Invalid API key" };
        return { valid: false, error: `API returned ${res.status}` };
      } catch (e) {
        return { valid: false, error: `Connection failed: ${(e as Error).message}` };
      }
    }

    case "SUPABASE_URL": {
      try {
        new URL(value);
        return { valid: true };
      } catch {
        return { valid: false, error: "Not a valid URL" };
      }
    }

    case "SUPABASE_ANON_KEY": {
      if (value.startsWith("eyJ") && value.includes(".")) return { valid: true };
      return { valid: false, error: "Doesn't look like a JWT (should start with eyJ)" };
    }

    case "GOOGLE_CLIENT_ID":
    case "GOOGLE_CLIENT_SECRET":
      return { valid: true }; // Just non-empty, already checked above

    default:
      return { valid: true };
  }
}

// ---------------------------------------------------------------------------
// GET — return manifest with masked values and health status
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "read", "env-keys");
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await Promise.all(
    KEY_MANIFEST.map(async (def) => {
      const { source, value } = detectSource(def.name, def.envFile);
      let health: "valid" | "invalid" | "unchecked" | "missing" = "unchecked";
      let healthError: string | undefined;

      if (source === "missing") {
        health = def.optional ? "unchecked" : "missing";
      } else {
        const result = await validateKey(def.name, value);
        health = result.valid ? "valid" : "invalid";
        healthError = result.error;
      }

      return {
        name: def.name,
        category: def.category,
        optional: def.optional,
        masked: source !== "missing" ? maskValue(value) : null,
        source,
        health,
        healthError,
        validationHint: def.validationHint,
      };
    })
  );

  return NextResponse.json(keys);
}

// ---------------------------------------------------------------------------
// PATCH — update a single key
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "write", "env-keys");
  if (!auth.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, value } = await req.json();

  if (typeof name !== "string" || typeof value !== "string") {
    return NextResponse.json({ error: "name and value must be strings" }, { status: 400 });
  }

  const def = KEY_MANIFEST.find((k) => k.name === name);
  if (!def) {
    return NextResponse.json({ error: `Unknown key: ${name}` }, { status: 400 });
  }

  // Validate before writing
  const validation = await validateKey(name, value);
  if (!validation.valid) {
    return NextResponse.json(
      { error: `Validation failed: ${validation.error}`, validated: false },
      { status: 422 }
    );
  }

  // Write to .env file
  const envPath = path.join(PROJECT_ROOT, def.envFile);
  try {
    let content = "";
    try {
      content = fs.readFileSync(envPath, "utf-8");
    } catch {
      // File doesn't exist, will create
    }

    const regex = new RegExp(`^${name}=.*$`, "m");
    const newLine = `${name}=${value}`;

    if (regex.test(content)) {
      content = content.replace(regex, newLine);
    } else {
      content = content.trimEnd() + "\n" + newLine + "\n";
    }

    fs.writeFileSync(envPath, content, "utf-8");

    // Update process.env in-place (no restart needed)
    process.env[name] = value;

    return NextResponse.json({
      success: true,
      masked: maskValue(value),
      health: "valid",
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to write: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

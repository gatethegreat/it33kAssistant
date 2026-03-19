import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || "/mnt/c/Users/Admin/Documents/PersonalAIssistant";
const CLAUDE_MD_PATH = join(PROJECT_ROOT, "CLAUDE.md");

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "view_claude_md", "settings/claude-md");
  if (!auth.authorized) return auth.response;

  try {
    const content = await readFile(CLAUDE_MD_PATH, "utf-8");
    return NextResponse.json({ content, path: CLAUDE_MD_PATH });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return NextResponse.json({ content: "", path: CLAUDE_MD_PATH });
    }
    return NextResponse.json(
      { error: "Failed to read CLAUDE.md" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "edit_claude_md", "settings/claude-md");
  if (!auth.authorized) return auth.response;

  try {
    const { content } = await req.json();
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content must be a string" }, { status: 400 });
    }
    await writeFile(CLAUDE_MD_PATH, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write CLAUDE.md" },
      { status: 500 }
    );
  }
}

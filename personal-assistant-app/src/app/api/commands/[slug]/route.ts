import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, "../../../../..");
const COMMANDS_DIR = path.join(PROJECT_ROOT, ".claude", "commands");

function resolveCommandPath(slug: string): string | null {
  // slug can be "foo" (top-level) or "consider/pareto" (grouped)
  const parts = slug.split("/");
  if (parts.length === 1) {
    const p = path.join(COMMANDS_DIR, `${slug}.md`);
    return fs.existsSync(p) ? p : null;
  }
  if (parts.length === 2) {
    const p = path.join(COMMANDS_DIR, parts[0], `${parts[1]}.md`);
    return fs.existsSync(p) ? p : null;
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const filePath = resolveCommandPath(decoded);

  if (!filePath) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json({ slug: decoded, content });
  } catch {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const filePath = resolveCommandPath(decoded);

  if (!filePath) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }

  const { content } = await req.json();
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  return NextResponse.json({ slug: decoded, saved: true });
}

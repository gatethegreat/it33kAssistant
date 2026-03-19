import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, "../../../../..");
const SKILLS_DIR = path.join(PROJECT_ROOT, ".claude", "skills");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const skillFile = path.join(SKILLS_DIR, slug, "SKILL.md");

  try {
    const content = fs.readFileSync(skillFile, "utf-8");
    return NextResponse.json({ slug, content });
  } catch {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const skillFile = path.join(SKILLS_DIR, slug, "SKILL.md");

  // Verify skill directory exists
  const skillDir = path.join(SKILLS_DIR, slug);
  if (!fs.existsSync(skillDir)) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const { content } = await req.json();
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }

  fs.writeFileSync(skillFile, content, "utf-8");
  return NextResponse.json({ slug, saved: true });
}

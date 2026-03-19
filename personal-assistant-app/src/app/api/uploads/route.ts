import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireRole } from "@/lib/auth-guard";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/markdown",
]);

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".md"]);

function isAllowed(file: File): boolean {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const ext = path.extname(file.name).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "operator"], "upload_file", "uploads");
  if (!auth.authorized) return auth.response;

  const formData = await req.formData();
  const runId = formData.get("run_id") as string | null;

  if (!runId) {
    return NextResponse.json({ error: "run_id is required" }, { status: 400 });
  }

  // Sanitize runId to prevent path traversal
  const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeRunId) {
    return NextResponse.json({ error: "Invalid run_id" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  // Validate file types
  const rejected = files.filter((f) => !isAllowed(f));
  if (rejected.length > 0) {
    return NextResponse.json(
      { error: `Only images and markdown files are allowed. Rejected: ${rejected.map((f) => f.name).join(", ")}` },
      { status: 400 }
    );
  }

  const runDir = path.join(UPLOADS_ROOT, safeRunId);
  fs.mkdirSync(runDir, { recursive: true });

  const saved: { name: string; path: string; size: number; type: string }[] = [];

  for (const file of files) {
    // Sanitize filename — keep extension, strip dangerous chars
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(runDir, safeName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    saved.push({
      name: file.name,
      path: filePath,
      size: buffer.length,
      type: file.type,
    });
  }

  return NextResponse.json({ files: saved }, { status: 201 });
}

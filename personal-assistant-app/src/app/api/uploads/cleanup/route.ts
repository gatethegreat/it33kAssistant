import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export async function POST() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    return NextResponse.json({ deleted: 0 });
  }

  const now = Date.now();
  let deleted = 0;

  const entries = fs.readdirSync(UPLOADS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(UPLOADS_ROOT, entry.name);
    const stat = fs.statSync(dirPath);

    if (now - stat.mtimeMs > MAX_AGE_MS) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      deleted++;
    }
  }

  return NextResponse.json({ deleted });
}

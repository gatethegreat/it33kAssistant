import { NextRequest, NextResponse } from "next/server";
import { submitApproval } from "@/lib/approval-store";

// Retry with short delay — in dev mode, the approve POST can arrive
// before or after the approval promise is registered due to route compilation timing.
async function trySubmit(runId: string, toolUseId: string, approved: boolean, retries = 5): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    if (submitApproval(runId, toolUseId, approved)) return true;
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;
  const body = await req.json();
  const { tool_use_id, approved } = body;

  if (!tool_use_id || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "tool_use_id and approved (boolean) are required" },
      { status: 400 }
    );
  }

  const found = await trySubmit(runId, tool_use_id, approved);
  if (!found) {
    return NextResponse.json(
      { error: "No pending approval found — it may have timed out" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

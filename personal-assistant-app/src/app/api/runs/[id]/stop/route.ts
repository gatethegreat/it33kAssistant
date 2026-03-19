import { NextRequest, NextResponse } from "next/server";
import { stopRun } from "@/lib/agent-runner";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;
  const stopped = await stopRun(runId);

  if (!stopped) {
    return NextResponse.json({ error: "Run not found or already stopped" }, { status: 404 });
  }

  return NextResponse.json({ stopped: true });
}

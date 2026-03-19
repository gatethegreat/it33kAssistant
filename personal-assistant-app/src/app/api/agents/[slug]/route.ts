import { NextRequest, NextResponse } from "next/server";
import { getAgent, updateAgentMeta, deleteAgent } from "@/lib/agents";
import { getAgentCapabilities } from "@/lib/capabilities";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const capabilities = getAgentCapabilities(slug);

  return NextResponse.json({ ...agent, capabilities });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (slug === "main") {
    return NextResponse.json({ error: "Main agent cannot be edited" }, { status: 400 });
  }

  const body = await req.json();
  const { name, description, emoji, vibe, tools, mcpServers } = body;

  const updated = updateAgentMeta(slug, { name, description, emoji, vibe, tools, mcpServers });
  if (!updated) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (slug === "main") {
    return NextResponse.json({ error: "Main agent cannot be deleted" }, { status: 400 });
  }

  const deleted = deleteAgent(slug);
  if (!deleted) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

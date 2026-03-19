import { NextRequest, NextResponse } from "next/server";
import { getAgents, createAgent } from "@/lib/agents";

export async function GET() {
  const agents = getAgents();
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, tools, mcpServers, color, emoji, vibe, model, content } = body;

    if (!name || !description || !content) {
      return NextResponse.json(
        { error: "name, description, and content are required" },
        { status: 400 }
      );
    }

    const agent = createAgent({ name, description, tools, mcpServers, color, emoji, vibe, model, content });
    return NextResponse.json(agent, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create agent";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

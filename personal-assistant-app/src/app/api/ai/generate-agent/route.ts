import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an agent architect. Given a user's description of what they want an agent to do, generate a complete agent definition.

Return a JSON object with these fields:
- name: A short, descriptive name (2-4 words)
- description: One sentence explaining what the agent does
- tools: Comma-separated list of tools the agent needs. Available tools: WebFetch, WebSearch, Read, Write, Edit, Bash, Glob, Grep
- color: A hex color or named color that fits the agent's theme (e.g., "#10B981", "teal", "purple", "#F59E0B")
- emoji: A single emoji that represents the agent
- vibe: A short, witty tagline (under 80 chars) describing the agent's personality
- content: The full system prompt for the agent in markdown. This should be detailed and include:
  - An identity section explaining who the agent is and what it does
  - Specific instructions for how it should operate
  - Any relevant constraints or guidelines
  - Output format preferences if applicable

The content should be well-structured markdown with headers. Make the agent focused and practical.

Return ONLY valid JSON, no markdown fences or extra text.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Create an agent for the following purpose:\n\n${prompt}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Anthropic API error ${res.status}: ${body}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";

    // Strip markdown fences if present
    const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const agent = JSON.parse(cleaned);

    // Validate required fields
    if (!agent.name || !agent.description || !agent.content) {
      return NextResponse.json(
        { error: "AI generated incomplete agent definition" },
        { status: 500 }
      );
    }

    return NextResponse.json(agent);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate agent" },
      { status: 500 }
    );
  }
}

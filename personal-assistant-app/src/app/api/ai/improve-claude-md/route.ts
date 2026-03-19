import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are a precise editor for CLAUDE.md files (project-level instructions for Claude Code).

Rules:
- Apply ONLY the changes the user requests. Do not rewrite, reformat, or "improve" anything else.
- Preserve the exact structure, formatting, whitespace, and ordering of sections you don't touch.
- Return the COMPLETE file contents with your changes applied — nothing else.
- Do NOT wrap output in markdown code fences or add any explanation.
- Do NOT add or remove blank lines unless the user specifically asks.
- If the instruction is unclear, make the minimal reasonable interpretation.`;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "improve_claude_md", "settings/claude-md");
  if (!auth.authorized) return auth.response;

  const { content, instruction } = await req.json();

  if (typeof content !== "string" || typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json(
      { error: "content and instruction are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            parts: [
              {
                text: `Here is the current CLAUDE.md file:\n\n${content}\n\n---\n\nUser instruction: ${instruction}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 16384,
          temperature: 0.1,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    let improved =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip any accidental code fences the model might add
    improved = improved
      .replace(/^```(?:markdown|md)?\s*\n/i, "")
      .replace(/\n```\s*$/, "");

    return NextResponse.json({ improved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to improve content" },
      { status: 500 }
    );
  }
}

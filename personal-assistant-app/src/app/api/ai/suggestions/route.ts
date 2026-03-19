import { NextRequest, NextResponse } from "next/server";
import { callHaiku } from "@/lib/ai";

// In-memory cache: key = "slug:hash" → suggestions[]
const cache = new Map<string, { suggestions: string[]; hash: string }>();

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const name = req.nextUrl.searchParams.get("name");
  const description = req.nextUrl.searchParams.get("description");

  if (!slug || !name || !description) {
    return NextResponse.json(
      { error: "slug, name, and description are required" },
      { status: 400 }
    );
  }

  const hash = hashString(`${name}:${description}`);
  const cached = cache.get(slug);
  if (cached && cached.hash === hash) {
    return NextResponse.json({ suggestions: cached.suggestions });
  }

  try {
    const raw = await callHaiku(
      "You generate short prompt suggestions for an AI assistant chat interface. Return exactly 3 suggestions as a JSON array of strings. Each suggestion should be a natural, conversational request that a user might ask this specific agent. Keep them short (under 60 chars), varied in topic, and practical. Return ONLY the JSON array, no other text.",
      [
        {
          role: "user",
          content: `Agent name: ${name}\nAgent description: ${description}\n\nGenerate 4 prompt suggestions:`,
        },
      ],
      200
    );

    // Strip markdown code fences if present
    const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const suggestions = JSON.parse(cleaned);
    if (Array.isArray(suggestions) && suggestions.length >= 3) {
      const result = suggestions.slice(0, 3).map(String);
      cache.set(slug, { suggestions: result, hash });
      return NextResponse.json({ suggestions: result });
    }

    return NextResponse.json(
      { error: "Invalid response from model" },
      { status: 500 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

const SYSTEM_PROMPT =
  "You name chat conversations. Given the user's first message, generate a very short chat title (2-5 words max). Start with a relevant emoji. Return ONLY the title, nothing else. Examples:\n🐛 Fix login bug\n📊 Sales dashboard layout\n🚀 Deploy to production\n✍️ Write blog post\n📧 Email template help";

async function generateTitle(message: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: message }] }],
      generationConfig: { maxOutputTokens: 30, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text.trim().replace(/^["']|["']$/g, "");
}

export async function POST(req: NextRequest) {
  const { session_id, message } = await req.json();

  if (!session_id || !message) {
    return NextResponse.json(
      { error: "session_id and message are required" },
      { status: 400 }
    );
  }

  // Check if title already exists
  const { data: existing } = await supabase
    .from("session_titles")
    .select("title")
    .eq("session_id", session_id)
    .single();

  if (existing?.title) {
    return NextResponse.json({ title: existing.title });
  }

  try {
    const title = await generateTitle(message);

    await supabase
      .from("session_titles")
      .upsert({ session_id, title });

    return NextResponse.json({ title });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate title" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const sessionIds = req.nextUrl.searchParams.get("session_ids");
  if (!sessionIds) {
    return NextResponse.json({ error: "session_ids required" }, { status: 400 });
  }

  const ids = sessionIds.split(",").filter(Boolean);
  const { data } = await supabase
    .from("session_titles")
    .select("session_id, title")
    .in("session_id", ids);

  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.session_id] = row.title;
  }

  return NextResponse.json({ titles: map });
}

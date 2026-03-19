import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getQueue } from "@/lib/queue";

export async function GET() {
  const { data, error } = await supabase
    .from("agent_schedules")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agent_slug, agent_name, prompt, cron, skill_slug } = body;

  if (!agent_slug || !agent_name || !cron) {
    return NextResponse.json(
      { error: "agent_slug, agent_name, and cron are required" },
      { status: 400 }
    );
  }

  if (!prompt && !skill_slug) {
    return NextResponse.json(
      { error: "Either prompt or skill_slug is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("agent_schedules")
    .insert({
      agent_slug,
      agent_name,
      prompt: prompt || "",
      cron,
      skill_slug: skill_slug || null,
      enabled: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Register with BullMQ
  try {
    const queue = getQueue();
    await queue.upsertJobScheduler(
      `schedule-${data.id}`,
      { pattern: cron },
      {
        name: "scheduled-agent-run",
        data: {
          scheduleId: data.id,
          agentSlug: data.agent_slug,
          agentName: data.agent_name,
          prompt: data.prompt,
          skillSlug: data.skill_slug || undefined,
        },
      }
    );
  } catch (err) {
    console.error("Failed to register BullMQ scheduler:", err);
  }

  return NextResponse.json(data, { status: 201 });
}

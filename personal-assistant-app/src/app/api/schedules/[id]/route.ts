import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getQueue } from "@/lib/queue";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.prompt !== undefined) updates.prompt = body.prompt;
  if (body.cron !== undefined) updates.cron = body.cron;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.skill_slug !== undefined) updates.skill_slug = body.skill_slug || null;

  const { data, error } = await supabase
    .from("agent_schedules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync with BullMQ
  try {
    const queue = getQueue();
    if (data.enabled) {
      await queue.upsertJobScheduler(
        `schedule-${id}`,
        { pattern: data.cron },
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
    } else {
      await queue.removeJobScheduler(`schedule-${id}`);
    }
  } catch (err) {
    console.error("Failed to sync BullMQ scheduler:", err);
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Remove from BullMQ first
  try {
    const queue = getQueue();
    await queue.removeJobScheduler(`schedule-${id}`);
  } catch (err) {
    console.error("Failed to remove BullMQ scheduler:", err);
  }

  const { error } = await supabase
    .from("agent_schedules")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

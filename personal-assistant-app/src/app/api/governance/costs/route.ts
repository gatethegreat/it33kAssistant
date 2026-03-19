import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireRole } from "@/lib/auth-guard";

/**
 * GET /api/governance/costs
 *
 * Returns cost aggregations from agent_runs for today, this week, and this month.
 * Also returns per-agent breakdowns and top runs by cost.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin"], "governance:costs", "/api/governance/costs");
  if (!auth.authorized) return auth.response!;

  const now = new Date();

  // Start of today (UTC)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Start of this week (Monday, UTC)
  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  // Start of this month (UTC)
  const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

  // Fetch all runs with cost data from this month (superset of week and day)
  const { data: runs, error } = await supabase
    .from("agent_runs")
    .select("cost_usd, agent_slug, agent_name, created_at, duration_ms, prompt")
    .gte("created_at", monthStart.toISOString())
    .not("cost_usd", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const safeRuns = runs || [];

  // Aggregate by time period
  let todayTotal = 0;
  let todayCount = 0;
  let weekTotal = 0;
  let weekCount = 0;
  let monthTotal = 0;
  let monthCount = 0;

  // Per-agent breakdown (for the month)
  const agentCosts: Record<string, { name: string; total: number; count: number }> = {};

  for (const run of safeRuns) {
    const cost = run.cost_usd as number;
    const createdAt = new Date(run.created_at);
    const slug = run.agent_slug as string;
    const name = run.agent_name as string;

    // Month (all runs in result set)
    monthTotal += cost;
    monthCount++;

    // Week
    if (createdAt >= weekStart) {
      weekTotal += cost;
      weekCount++;
    }

    // Today
    if (createdAt >= todayStart) {
      todayTotal += cost;
      todayCount++;
    }

    // Per-agent
    if (!agentCosts[slug]) {
      agentCosts[slug] = { name, total: 0, count: 0 };
    }
    agentCosts[slug].total += cost;
    agentCosts[slug].count++;
  }

  // Sort agents by total cost descending
  const agentBreakdown = Object.entries(agentCosts)
    .map(([slug, data]) => ({
      slug,
      name: data.name,
      total: data.total,
      count: data.count,
      avgPerRun: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Top 5 most expensive individual runs this month
  const topRuns = safeRuns
    .sort((a, b) => (b.cost_usd as number) - (a.cost_usd as number))
    .slice(0, 5)
    .map((r) => ({
      agent_name: r.agent_name,
      cost_usd: r.cost_usd,
      prompt: (r.prompt as string)?.slice(0, 80) || "—",
      created_at: r.created_at,
    }));

  return NextResponse.json({
    periods: {
      today: { total: todayTotal, count: todayCount },
      week: { total: weekTotal, count: weekCount },
      month: { total: monthTotal, count: monthCount },
    },
    agentBreakdown,
    topRuns,
  });
}

import { getAgents } from "@/lib/agents";
import { AgentGrid } from "@/components/agent-grid";

export default function AgentsPage() {
  const agents = getAgents();
  const specialists = agents.filter((a) => a.slug !== "main");
  return <AgentGrid agents={specialists} />;
}

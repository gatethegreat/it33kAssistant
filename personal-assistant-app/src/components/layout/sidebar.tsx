"use client";

import { usePathname } from "next/navigation";
import { useOverview } from "@/components/overview/overview-context";
import { Nav } from "./nav";
import { AgentSidebar } from "./agent-sidebar";

export function Sidebar() {
  const pathname = usePathname();
  const { isOverview } = useOverview();

  // If the overview context says we're on an overview tab, show Nav
  if (isOverview) {
    return <Nav />;
  }

  // Root path is rewritten to /agents/main/chat — treat it as main agent
  if (pathname === "/") {
    return <AgentSidebar slug="main" />;
  }

  // On any agent chat page, show agent session sidebar
  const chatMatch = pathname.match(/^\/agents\/([^/]+)\/chat/);
  if (chatMatch) {
    return <AgentSidebar slug={chatMatch[1]} />;
  }

  // Fallback
  return <Nav />;
}

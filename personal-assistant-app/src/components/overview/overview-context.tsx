"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type OverviewTab = "agents" | "skills" | "commands" | "runs" | "schedules" | "governance" | "settings";

const OVERVIEW_PATHS = ["/agents", "/skills", "/commands", "/runs", "/schedules", "/governance", "/settings"];

export function isOverviewPath(pathname: string): boolean {
  return OVERVIEW_PATHS.some((p) => pathname === p);
}

function pathToTab(pathname: string): OverviewTab | null {
  if (pathname === "/agents") return "agents";
  if (pathname.startsWith("/skills")) return "skills";
  if (pathname.startsWith("/commands")) return "commands";
  if (pathname.startsWith("/runs")) return "runs";
  if (pathname.startsWith("/schedules")) return "schedules";
  if (pathname.startsWith("/governance")) return "governance";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

interface OverviewContextValue {
  activeTab: OverviewTab;
  setTab: (tab: OverviewTab) => void;
  isOverview: boolean;
}

const OverviewContext = createContext<OverviewContextValue>({
  activeTab: "agents",
  setTab: () => {},
  isOverview: false,
});

export function useOverview() {
  return useContext(OverviewContext);
}

const TAB_PATHS: Record<OverviewTab, string> = {
  agents: "/agents",
  skills: "/skills",
  commands: "/commands",
  runs: "/runs",
  schedules: "/schedules",
  governance: "/governance",
  settings: "/settings",
};

export function OverviewProvider({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const detectedTab = pathToTab(pathname);
  const [isOverview, setIsOverview] = useState(detectedTab !== null);
  const [activeTab, setActiveTab] = useState<OverviewTab>(detectedTab || "agents");

  useEffect(() => {
    const tab = pathToTab(pathname);
    setIsOverview(tab !== null);
    if (tab) {
      setActiveTab(tab);
    }
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      const tab = pathToTab(window.location.pathname);
      if (tab) {
        setIsOverview(true);
        setActiveTab(tab);
      } else {
        setIsOverview(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setTab = useCallback((tab: OverviewTab) => {
    setActiveTab(tab);
    setIsOverview(true);
    window.history.pushState(null, "", TAB_PATHS[tab]);
  }, []);

  return (
    <OverviewContext.Provider value={{ activeTab, setTab, isOverview }}>
      {children}
    </OverviewContext.Provider>
  );
}

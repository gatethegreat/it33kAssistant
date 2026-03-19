"use client";

import Link from "next/link";
import { useOverview, type OverviewTab } from "@/components/overview/overview-context";
import { useAuth } from "@/components/auth/auth-context";
import { ProfileMenu } from "./profile-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  BrainIcon,
  AgentsIcon,
  BoltIcon,
  TerminalIcon,
  HistoryIcon,
  ScheduleIcon,
  ShieldIcon,
  GearIcon,
} from "@/components/icons";

const tabs: {
  tab: OverviewTab;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
}[] = [
  { tab: "agents", label: "Agents", Icon: AgentsIcon },
  { tab: "skills", label: "Skills", Icon: BoltIcon },
  { tab: "commands", label: "Commands", Icon: TerminalIcon },
  { tab: "runs", label: "Runs", Icon: HistoryIcon },
  { tab: "schedules", label: "Schedules", Icon: ScheduleIcon },
  { tab: "governance", label: "Governance", Icon: ShieldIcon, adminOnly: true },
  { tab: "settings", label: "Settings", Icon: GearIcon, adminOnly: true },
];

export function Nav() {
  const { activeTab, setTab } = useOverview();
  const { role } = useAuth();

  return (
    <nav className="w-[220px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-base)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Overview</span>
        <NotificationBell />
      </div>

      {/* Nav items */}
      <div className="flex flex-col gap-px px-2 flex-1">
        {/* PAI Agent — real navigation */}
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <BrainIcon size={16} className="shrink-0 opacity-70" />
          <span>PAI Agent</span>
        </Link>

        <div className="h-px bg-[var(--border-subtle)] my-1.5 mx-1" />

        {/* Overview tabs */}
        {tabs
          .filter(({ adminOnly }) => !adminOnly || role === "admin")
          .map(({ tab, label, Icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-left transition-colors ${
                  isActive
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <Icon size={16} className={`shrink-0 ${isActive ? "opacity-90" : "opacity-60"}`} />
                <span>{label}</span>
              </button>
            );
          })}
      </div>

      {/* Profile — pinned to bottom */}
      <div className="border-t border-[var(--border-subtle)] px-2 py-2">
        <ProfileMenu />
      </div>
    </nav>
  );
}

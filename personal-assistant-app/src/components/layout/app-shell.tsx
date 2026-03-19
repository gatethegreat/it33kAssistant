"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { OverviewProvider } from "@/components/overview/overview-context";
import { OverviewInner } from "./overview-inner";
import { AuthProvider } from "@/components/auth/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Login and not-authorized pages render standalone — no sidebar or overview shell
  if (pathname === "/login" || pathname === "/not-authorized") {
    return <AuthProvider>{children}</AuthProvider>;
  }

  return (
    <AuthProvider>
      <OverviewProvider pathname={pathname}>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto px-8 py-6">
            <OverviewInner>{children}</OverviewInner>
          </main>
        </div>
      </OverviewProvider>
    </AuthProvider>
  );
}

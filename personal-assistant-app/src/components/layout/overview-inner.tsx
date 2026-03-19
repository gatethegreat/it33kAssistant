"use client";

import { useOverview } from "@/components/overview/overview-context";
import { OverviewContent } from "@/components/overview/overview-content";

export function OverviewInner({ children }: { children: React.ReactNode }) {
  const { isOverview } = useOverview();

  if (isOverview) {
    return <OverviewContent />;
  }

  return <>{children}</>;
}

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { getToolDescription } from "@/lib/tool-descriptions";

/**
 * Portal-based tooltip for tool names.
 * Renders the tooltip at document.body level so it's never clipped by
 * overflow:hidden/auto on parent containers (modals, sidebars, etc.).
 */
export function ToolBadge({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const desc = getToolDescription(name);
  const ref = useRef<HTMLSpanElement>(null);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const handleEnter = useCallback(() => {
    if (!desc) return;
    updatePos();
    setShow(true);
  }, [desc, updatePos]);

  const handleLeave = useCallback(() => {
    setShow(false);
  }, []);

  // Update position on scroll while visible
  useEffect(() => {
    if (!show) return;
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [show, updatePos]);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={className}
      >
        {children ?? name}
      </span>
      {show && desc && pos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y - 8,
              transform: "translate(-50%, -100%)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="whitespace-nowrap rounded-md bg-[#111113] border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] shadow-lg"
          >
            {desc}
          </div>,
          document.body
        )}
    </>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { PreferencesModal } from "@/components/preferences-modal";
import { GearIcon, LogOutIcon, ClockIcon } from "@/components/icons";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const initials = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <div className="h-5 w-5 rounded-full bg-[var(--bg-elevated)] animate-pulse" />
        <div className="h-3 w-20 rounded bg-[var(--bg-elevated)] animate-pulse" />
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-5 w-5 rounded-full shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex items-center justify-center h-5 w-5 rounded-full bg-[var(--bg-elevated)] text-[10px] font-semibold text-[var(--text-secondary)] shrink-0">
            {initials}
          </div>
        )}
        <span className="truncate">{displayName}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-[var(--border-default)] bg-[#111113] shadow-xl shadow-black/40 overflow-hidden z-50">
          <button
            onClick={() => { setOpen(false); setPrefsOpen(true); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ClockIcon size={14} className="opacity-60" />
            Preferences
          </button>
          <div className="h-px bg-[var(--border-subtle)]" />
          <button
            onClick={() => { setOpen(false); router.push("/settings"); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <GearIcon size={14} className="opacity-60" />
            Settings
          </button>
          <div className="h-px bg-[var(--border-subtle)]" />
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <LogOutIcon size={14} className="opacity-60" />
            Log out
          </button>
        </div>
      )}

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </div>
  );
}

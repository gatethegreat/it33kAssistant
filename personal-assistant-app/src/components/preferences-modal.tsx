"use client";

import { useState, useEffect, useCallback } from "react";
import { XIcon } from "@/components/icons";

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
}

export function PreferencesModal({ open, onClose }: PreferencesModalProps) {
  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        setPreferences(data.preferences || "");
        setDirty(false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      setDirty(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, save]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-lg border border-[var(--border-default)] bg-[#111113] shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Personal Preferences</h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Sent to the AI with every message as context about you.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
            <XIcon size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="h-48 rounded-md bg-[var(--bg-raised)] animate-pulse" />
          ) : (
            <>
              <textarea
                value={preferences}
                onChange={(e) => { setPreferences(e.target.value); setDirty(true); }}
                placeholder={"Tell the AI about yourself — your role, communication style, technical level, preferred tools, formatting preferences.\n\nExamples:\n• I'm a senior engineer, skip basic explanations\n• Always respond concisely — no fluff\n• I prefer TypeScript over JavaScript"}
                className="w-full h-48 rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)] resize-none"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-2">
                {preferences.length} characters{dirty ? " · unsaved" : ""} · Ctrl+S to save
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors">
            Cancel
          </button>
          <button
            onClick={async () => { await save(); onClose(); }}
            disabled={saving || !dirty}
            className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

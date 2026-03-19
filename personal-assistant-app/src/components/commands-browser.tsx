"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { CommandInfo } from "@/lib/capabilities";
import {
  SearchIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  CheckIcon,
  TerminalIcon,
  PackageIcon,
} from "@/components/icons";

const GROUP_LABELS: Record<string, string> = {
  consider: "Decision Frameworks",
};

export function CommandsBrowser() {
  const [commands, setCommands] = useState<CommandInfo[] | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [commandContent, setCommandContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/commands")
      .then((r) => r.json())
      .then((data: CommandInfo[]) => setCommands(data));
  }, []);

  const loadCommandContent = useCallback((slug: string) => {
    setSelectedCommand(slug);
    setLoadingContent(true);
    setEditing(false);
    setSaveStatus("idle");
    fetch(`/api/commands/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        setCommandContent(data.content || "");
        setEditContent(data.content || "");
        setLoadingContent(false);
      })
      .catch(() => {
        setCommandContent(null);
        setLoadingContent(false);
      });
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  const handleSave = async () => {
    if (!selectedCommand) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/commands/${encodeURIComponent(selectedCommand)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setCommandContent(editContent);
        setEditing(false);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
    setSaving(false);
  };

  const handleBack = () => {
    setSelectedCommand(null);
    setCommandContent(null);
    setEditing(false);
    setSaveStatus("idle");
  };

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  if (!commands) {
    return (
      <div>
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">Commands</h1>
        <div className="space-y-2 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-[var(--bg-raised)]" />
          ))}
        </div>
      </div>
    );
  }

  // Group: ungrouped first, then grouped
  const ungrouped = commands.filter((c) => !c.group);
  const groups = commands.reduce<Record<string, CommandInfo[]>>((acc, cmd) => {
    if (cmd.group) {
      (acc[cmd.group] ||= []).push(cmd);
    }
    return acc;
  }, {});
  const groupNames = Object.keys(groups).sort();

  // Filter by search
  const q = searchQuery.toLowerCase();
  const filterItems = (items: CommandInfo[]) => {
    if (!q) return items;
    return items.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  };

  const filteredUngrouped = filterItems(ungrouped);
  const totalFiltered = filteredUngrouped.length + groupNames.reduce((sum, g) => sum + filterItems(groups[g]).length, 0);

  const selectedInfo = commands.find((c) => c.slug === selectedCommand);

  // ---- Detail View ----
  if (selectedCommand) {
    return (
      <div ref={detailRef} className="flex flex-col" style={{ height: "calc(100vh - 6rem)" }}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleBack}
              className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <ChevronLeftIcon size={14} />
              Back
            </button>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                /{selectedCommand}
              </h1>
              {selectedInfo?.description && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 truncate">{selectedInfo.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-[11px] text-green-400/80">
                <CheckIcon size={12} />
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-[11px] text-red-400/80">Save failed</span>
            )}
            {editing ? (
              <>
                <button
                  onClick={() => { setEditing(false); setEditContent(commandContent || ""); }}
                  className="rounded-md px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <EditIcon size={12} />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="mb-3 shrink-0">
          <code className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">
            .claude/commands/{selectedCommand}.md
          </code>
        </div>

        {loadingContent ? (
          <div className="flex-1 animate-pulse space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 rounded bg-[var(--bg-raised)]" style={{ width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>
        ) : editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 min-h-0 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-4 text-[13px] text-[var(--text-secondary)] font-mono leading-relaxed resize-none focus:border-[var(--border-focus)] focus:outline-none"
            spellCheck={false}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words text-[13px] text-[var(--text-secondary)] font-mono leading-relaxed bg-[var(--bg-raised)] rounded-lg border border-[var(--border-subtle)] p-4">
              {commandContent}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ---- Browse View ----
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Commands</h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            {q ? `${totalFiltered} of ${commands.length}` : `${commands.length} commands`}
          </p>
        </div>
        <div className="w-56">
          <div className="relative">
            <SearchIcon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-raised)] pl-8 pr-3 py-1.5 text-[13px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {/* Ungrouped commands */}
        {filteredUngrouped.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <TerminalIcon size={14} className="text-[var(--text-tertiary)] opacity-70" />
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">General</span>
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{filteredUngrouped.length}</span>
            </div>
            <div className="ml-[26px] border-l border-[var(--border-subtle)]">
              {filteredUngrouped.map((cmd) => (
                <button
                  key={cmd.slug}
                  onClick={() => loadCommandContent(cmd.slug)}
                  className="group/item flex items-center gap-2 w-full text-left pl-4 pr-2 py-1.5 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <span className="text-[13px] text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors truncate">
                    /{cmd.slug}
                  </span>
                  {cmd.description && (
                    <span className="text-[11px] text-[var(--text-muted)] truncate flex-1">{cmd.description}</span>
                  )}
                  <ChevronRightIcon
                    size={12}
                    className="text-[var(--text-muted)] opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grouped commands */}
        {groupNames.map((group) => {
          const items = filterItems(groups[group]);
          if (!items.length) return null;
          const isCollapsed = collapsed[group] ?? false;
          const label = GROUP_LABELS[group] || group;

          return (
            <div key={group}>
              <button
                onClick={() => toggleGroup(group)}
                className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <ChevronDownIcon
                  size={12}
                  className={`text-[var(--text-muted)] transition-transform duration-150 ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <PackageIcon size={14} className="text-[var(--text-tertiary)] opacity-70" />
                <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                  {label}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{items.length}</span>
              </button>

              {!isCollapsed && (
                <div className="ml-[26px] border-l border-[var(--border-subtle)]">
                  {items.map((cmd) => (
                    <button
                      key={cmd.slug}
                      onClick={() => loadCommandContent(cmd.slug)}
                      className="group/item flex items-center gap-2 w-full text-left pl-4 pr-2 py-1.5 hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <span className="text-[13px] text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors truncate">
                        /{cmd.slug}
                      </span>
                      {cmd.description && (
                        <span className="text-[11px] text-[var(--text-muted)] truncate flex-1">{cmd.description}</span>
                      )}
                      <ChevronRightIcon
                        size={12}
                        className="text-[var(--text-muted)] opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {q && totalFiltered === 0 && (
          <div className="text-center py-12">
            <p className="text-[13px] text-[var(--text-tertiary)]">No commands match &ldquo;{searchQuery}&rdquo;</p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-2 text-[12px] text-[var(--accent-text)] hover:text-[var(--accent-hover)]"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { animateDiff } from "@/lib/typewriter-animation";

interface UserRole {
  id: string;
  email: string;
  role: "admin" | "operator" | "viewer";
  added_by: string | null;
  created_at: string;
}



type Tab = "users" | "api-keys" | "claude-md";

// ---------------------------------------------------------------------------
// Role permission matrix & explainer
// ---------------------------------------------------------------------------

interface Capability {
  label: string;
  admin: boolean;
  operator: boolean;
  viewer: boolean;
  note?: string;
}

const CAPABILITIES: Capability[] = [
  { label: "View chat & run history", admin: true, operator: true, viewer: true },
  { label: "Run agents & send messages", admin: true, operator: true, viewer: false },
  { label: "Upload files to runs", admin: true, operator: true, viewer: false },
  { label: "Delete sessions", admin: true, operator: true, viewer: false },
  { label: "Use all agent tools (Bash, Write, etc.)", admin: true, operator: true, viewer: false, note: "operator" },
  { label: "Modify source code & config files", admin: true, operator: false, viewer: false },
  { label: "Install packages (npm/pip)", admin: true, operator: false, viewer: false },
  { label: "Manage users & settings", admin: true, operator: false, viewer: false },
  { label: "Create scheduled runs", admin: true, operator: false, viewer: false },
];

const ROLE_META: Record<string, { label: string; color: string; tagBg: string; tagText: string; desc: string }> = {
  admin: {
    label: "Admin",
    color: "text-amber-400",
    tagBg: "bg-amber-400/10 border-amber-400/20",
    tagText: "text-amber-400",
    desc: "Unrestricted access to everything.",
  },
  operator: {
    label: "Operator",
    color: "text-[var(--accent-text)]",
    tagBg: "bg-[var(--accent-muted)] border-[var(--accent-muted)]",
    tagText: "text-[var(--accent-text)]",
    desc: "Can run agents, but cannot touch the codebase or settings.",
  },
  viewer: {
    label: "Viewer",
    color: "text-[var(--text-tertiary)]",
    tagBg: "bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
    tagText: "text-[var(--text-tertiary)]",
    desc: "Read-only. Can see history but can't change anything.",
  },
};

const ROLES_ORDER = ["admin", "operator", "viewer"] as const;

function RoleExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-[var(--border-subtle)]/80 bg-[var(--bg-base)]/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-elevated)]/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] text-[var(--text-tertiary)]">What can each role do?</span>
          <div className="flex gap-1.5">
            {ROLES_ORDER.map((r) => (
              <span
                key={r}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${ROLE_META[r].tagBg} ${ROLE_META[r].tagText}`}
              >
                {ROLE_META[r].label}
              </span>
            ))}
          </div>
        </div>
        <svg
          className={`h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--border-subtle)]/60">
          {/* Role summary cards */}
          <div className="grid grid-cols-3 gap-px bg-[var(--bg-elevated)]/30">
            {ROLES_ORDER.map((r) => (
              <div key={r} className="bg-[var(--bg-base)]/50 px-4 py-3">
                <div className={`text-[11px] font-semibold mb-1 ${ROLE_META[r].color}`}>
                  {ROLE_META[r].label}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                  {ROLE_META[r].desc}
                </div>
              </div>
            ))}
          </div>

          {/* Permission matrix */}
          <div className="px-1 py-2">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left px-3 py-1.5 text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                    Capability
                  </th>
                  {ROLES_ORDER.map((r) => (
                    <th
                      key={r}
                      className={`text-center px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${ROLE_META[r].color}`}
                      style={{ width: "80px" }}
                    >
                      {ROLE_META[r].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((cap, i) => (
                  <tr
                    key={i}
                    className="border-t border-[var(--border-subtle)]/30 hover:bg-[var(--bg-elevated)]/10 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <span className="text-[12px] text-[var(--text-secondary)]">{cap.label}</span>
                      {cap.note === "operator" && (
                        <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                          (protected files blocked)
                        </span>
                      )}
                    </td>
                    {ROLES_ORDER.map((r) => (
                      <td key={r} className="text-center px-3 py-2">
                        {cap[r] ? (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/10">
                            <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[var(--bg-elevated)]/50">
                            <svg className="h-3 w-3 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
                            </svg>
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-[var(--border-subtle)]/30">
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Only users listed above can sign in. Operators can run agents and use all tools, but writes to source code,
              config files, and package managers are automatically blocked. Viewers have read-only access.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "users", label: "User Management", icon: "👥" },
  { key: "api-keys", label: "API Keys", icon: "🔑" },
  { key: "claude-md", label: "CLAUDE.md", icon: "📄" },
];

function UserManagementTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"viewer" | "operator" | "admin">("viewer");
  const [adding, setAdding] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/users");
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add user");
      }

      setNewEmail("");
      setNewRole("viewer");
      await fetchUsers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      const res = await fetch("/api/settings/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      await fetchUsers();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemove = async (id: string, email: string) => {
    try {
      const res = await fetch("/api/settings/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove user");
      }
      await fetchUsers();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-md bg-[var(--bg-elevated)]/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add user form */}
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as "viewer" | "operator" | "admin")}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)] transition-colors"
        >
          <option value="viewer">Viewer</option>
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={adding || !newEmail.trim()}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? "Adding..." : "Add User"}
        </button>
      </form>

      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* User list */}
      <div className="rounded-md border border-[var(--border-subtle)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/50">
              <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Role
              </th>
              <th className="text-left px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Added By
              </th>
              <th className="text-right px-4 py-3 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.email === user?.email;
              return (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border-subtle)]/50 last:border-0 hover:bg-[var(--bg-base)]/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-[var(--text-primary)]">{u.email}</span>
                    {isSelf && (
                      <span className="ml-2 text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] rounded px-1.5 py-0.5">
                        you
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={isSelf}
                      className={`rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-[11px] outline-none transition-colors ${
                        isSelf
                          ? "text-[var(--text-tertiary)] cursor-not-allowed"
                          : "text-[var(--text-secondary)] hover:border-[var(--border-default)] focus:border-[var(--border-focus)]"
                      }`}
                    >
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-[var(--text-tertiary)]">
                      {u.added_by || "system"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <button
                        onClick={() => handleRemove(u.id, u.email)}
                        className="text-[11px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Role explainer */}
      <RoleExplainer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Keys Tab
// ---------------------------------------------------------------------------

interface EnvKeyInfo {
  name: string;
  category: "core" | "auth";
  optional: boolean;
  masked: string | null;
  source: "env-file" | "process" | "missing";
  health: "valid" | "invalid" | "unchecked" | "missing";
  healthError?: string;
  validationHint: string;
}

function ApiKeysTab() {
  const [keys, setKeys] = useState<EnvKeyInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/env-keys");
      if (!res.ok) throw new Error("Failed to load keys");
      setKeys(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const startEdit = (name: string) => {
    setEditingKey(name);
    setEditValue("");
    setConfirmName("");
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setConfirmName("");
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editingKey || confirmName !== editingKey) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings/env-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingKey, value: editValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to save");
        setSaving(false);
        return;
      }
      cancelEdit();
      fetchKeys(); // Refresh all keys to show updated status
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const healthBadge = (health: EnvKeyInfo["health"], error?: string) => {
    switch (health) {
      case "valid":
        return <span className="inline-flex items-center gap-1 text-[11px] text-green-400" title="Key is valid"><span className="h-1.5 w-1.5 rounded-full bg-green-400" />Valid</span>;
      case "invalid":
        return <span className="inline-flex items-center gap-1 text-[11px] text-red-400" title={error}><span className="h-1.5 w-1.5 rounded-full bg-red-400" />Invalid{error ? `: ${error}` : ""}</span>;
      case "missing":
        return <span className="inline-flex items-center gap-1 text-[11px] text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Missing</span>;
      case "unchecked":
        return <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />Not set</span>;
    }
  };

  const sourceBadge = (source: EnvKeyInfo["source"]) => {
    switch (source) {
      case "env-file":
        return <span className="rounded px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">.env</span>;
      case "process":
        return <span className="rounded px-1.5 py-0.5 text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">shell</span>;
      case "missing":
        return null;
    }
  };

  const categoryBadge = (cat: EnvKeyInfo["category"], optional: boolean) => {
    if (cat === "core") {
      return <span className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--accent-muted)] text-[var(--accent-text)]">Core</span>;
    }
    return <span className="rounded px-1.5 py-0.5 text-[10px] bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">Auth{optional ? " (optional)" : ""}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-md bg-[var(--bg-elevated)]/30" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3">
        <p className="text-[13px] text-red-400">{error}</p>
        <button onClick={fetchKeys} className="mt-2 text-[12px] text-[var(--accent-text)] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">
          API keys and secrets loaded by the application. Values are never shown in full.
        </p>
        <button
          onClick={fetchKeys}
          className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-md border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
        {keys?.map((key) => (
          <div key={key.name} className="px-4 py-3">
            {/* Key info row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <code className="text-[13px] font-mono text-[var(--text-primary)] shrink-0">{key.name}</code>
                {categoryBadge(key.category, key.optional)}
                {sourceBadge(key.source)}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {healthBadge(key.health, key.healthError)}
                {editingKey !== key.name && (
                  <button
                    onClick={() => startEdit(key.name)}
                    className="rounded-md px-2.5 py-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    {key.source === "missing" ? "Set" : "Change"}
                  </button>
                )}
              </div>
            </div>

            {/* Masked value */}
            {key.masked && editingKey !== key.name && (
              <div className="mt-1">
                <span className="text-[12px] font-mono text-[var(--text-muted)] tracking-wider">{key.masked}</span>
              </div>
            )}

            {/* Edit form */}
            {editingKey === key.name && (
              <div className="mt-3 space-y-3">
                {/* Warning */}
                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-[12px] text-amber-300/90 font-medium mb-1">
                    {key.source === "missing" ? "Setting a new key" : "Changing this key takes effect immediately"}
                  </p>
                  <p className="text-[11px] text-amber-300/60">
                    {key.category === "core"
                      ? "An invalid key will break core application functionality."
                      : "This key is optional. Leaving it empty will disable related features."}
                    {" "}The new value will be validated before saving.
                  </p>
                </div>

                {/* Value input */}
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">New value</label>
                  <input
                    type="password"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder={key.validationHint}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-[13px] font-mono text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Confirmation input */}
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                    Type <code className="text-[var(--text-tertiary)]">{key.name}</code> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={key.name}
                    className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-[13px] font-mono text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:outline-none"
                  />
                </div>

                {/* Save error */}
                {saveError && (
                  <p className="text-[12px] text-red-400">{saveError}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !editValue || confirmName !== key.name}
                    className="rounded-md bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "Validating & saving..." : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-md px-3.5 py-1.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClaudeMdTab() {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("preview");

  // AI Improve state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== savedContent;

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/claude-md");
      if (!res.ok) throw new Error("Failed to load CLAUDE.md");
      const data = await res.json();
      setContent(data.content);
      setSavedContent(data.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Focus AI input when popout opens
  useEffect(() => {
    if (aiOpen) {
      setTimeout(() => aiInputRef.current?.focus(), 50);
    }
  }, [aiOpen]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && mode === "edit" && isDirty && !isAnimating) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isDirty, content, isAnimating]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/settings/claude-md", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setSavedContent(content);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAiImprove = async () => {
    if (!aiPrompt.trim() || aiLoading || isAnimating) return;

    setAiLoading(true);
    setError(null);
    setAiOpen(false);

    // Switch to edit mode so user sees the animation
    if (mode !== "edit") setMode("edit");

    try {
      const res = await fetch("/api/ai/improve-claude-md", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, instruction: aiPrompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "AI request failed");
      }

      const { improved } = await res.json();
      setAiLoading(false);

      if (improved === content) {
        setError("No changes needed — the AI found nothing to update for that instruction.");
        return;
      }

      // Start typewriter animation
      setIsAnimating(true);
      const controller = new AbortController();
      abortRef.current = controller;

      // Small delay so edit mode renders the textarea
      await new Promise((r) => setTimeout(r, 100));

      await animateDiff(
        textareaRef.current,
        content,
        improved,
        setContent,
        { deleteSpeed: 1, typeSpeed: 2, batchSize: 5, signal: controller.signal }
      );

      setContent(improved);
      setIsAnimating(false);
      setAiPrompt("");
      abortRef.current = null;
    } catch (e) {
      setAiLoading(false);
      setIsAnimating(false);
      setError((e as Error).message);
    }
  };

  const handleSkipAnimation = () => {
    abortRef.current?.abort();
  };

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-8 w-48 rounded-md bg-[var(--bg-elevated)]/40" />
        <div className="h-[500px] rounded-md bg-[var(--bg-elevated)]/30" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] p-0.5">
            <button
              onClick={() => setMode("preview")}
              disabled={isAnimating}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                mode === "preview"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              } disabled:opacity-40`}
            >
              Preview
            </button>
            <button
              onClick={() => setMode("edit")}
              disabled={isAnimating}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                mode === "edit"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              } disabled:opacity-40`}
            >
              Edit
            </button>
          </div>

          {/* Improve with AI button */}
          <div className="relative">
            <button
              onClick={() => setAiOpen(!aiOpen)}
              disabled={aiLoading || isAnimating}
              className="flex items-center gap-1.5 rounded-md bg-[var(--accent-muted)] border border-[var(--accent-muted)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-text)] transition-all hover:bg-[var(--accent)]/25 hover:border-[var(--accent)] hover:text-[var(--accent-text)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              Improve with AI
            </button>

            {/* AI Instruction Popout */}
            {aiOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAiOpen(false)}
                />
                {/* Popout card */}
                <div className="absolute top-full left-0 mt-2 z-50 w-96 rounded-md border border-[var(--accent-muted)] bg-[var(--bg-base)] shadow-2xl shadow-black/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)]/60">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      <span className="text-[11px] font-medium text-[var(--accent-text)]">AI Editor</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                      Describe what you want changed. Only the relevant sections will be updated.
                    </p>
                  </div>
                  <div className="p-3">
                    <textarea
                      ref={aiInputRef}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAiImprove();
                        }
                        if (e.key === "Escape") {
                          setAiOpen(false);
                        }
                      }}
                      placeholder="e.g. Add a section about deployment to AWS..."
                      className="w-full h-20 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none focus:border-[var(--border-focus)] transition-colors"
                    />
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to send
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAiOpen(false)}
                          className="rounded-md px-3 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAiImprove}
                          disabled={!aiPrompt.trim()}
                          className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDirty && !isAnimating && (
            <span className="text-[11px] text-amber-400/80">Unsaved changes</span>
          )}
          {success && (
            <span className="text-[11px] text-emerald-400">Saved</span>
          )}
          {mode === "edit" && !isAnimating && (
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* AI Loading / Animating Status Bar */}
      {(aiLoading || isAnimating) && (
        <div className="flex items-center justify-between rounded-md border border-[var(--accent-muted)] bg-[var(--accent-muted)] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            {aiLoading ? (
              <>
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.3s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:-0.15s]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
                </div>
                <span className="text-[11px] text-[var(--accent-text)]">Thinking...</span>
              </>
            ) : (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-[11px] text-[var(--accent-text)]">Applying changes...</span>
              </>
            )}
          </div>
          {isAnimating && (
            <button
              onClick={handleSkipAnimation}
              className="rounded-md px-2.5 py-1 text-[11px] text-[var(--accent-text)]/70 hover:text-[var(--accent-text)] hover:bg-[var(--accent-hover)]/10 transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* Editor / Preview */}
      {mode === "edit" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => !isAnimating && setContent(e.target.value)}
            readOnly={isAnimating}
            spellCheck={false}
            className={`w-full h-[calc(100vh-380px)] min-h-[400px] rounded-md border bg-[var(--bg-base)] px-5 py-4 text-[13px] text-[var(--text-primary)] font-mono leading-relaxed resize-none outline-none transition-colors placeholder:text-[var(--text-muted)] ${
              isAnimating
                ? "border-[var(--accent)] cursor-default"
                : "border-[var(--border-subtle)] focus:border-[var(--border-focus)]"
            }`}
            placeholder="# Project Instructions&#10;&#10;Write your CLAUDE.md content here..."
          />
          {!isAnimating && (
            <div className="absolute bottom-3 right-3 text-[10px] text-[var(--text-muted)]">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+S to save
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-6 py-5 min-h-[400px] max-h-[calc(100vh-380px)] overflow-y-auto">
          {content ? (
            <MarkdownPreview content={content} />
          ) : (
            <p className="text-[13px] text-[var(--text-muted)] italic">CLAUDE.md is empty. Switch to Edit mode to add content.</p>
          )}
        </div>
      )}

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        This file provides project-level instructions to Claude Code. Changes take effect immediately for all new conversations.
      </p>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  // Simple markdown renderer — handles headers, code blocks, lists, bold, links, tables
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div key={elements.length} className="my-3 rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] overflow-hidden">
          {lang && (
            <div className="px-3 py-1.5 text-[10px] text-[var(--text-tertiary)] border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/80">
              {lang}
            </div>
          )}
          <pre className="px-4 py-3 overflow-x-auto">
            <code className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const sizes: Record<number, string> = {
        1: "text-xl font-bold text-[var(--text-primary)] mt-6 mb-3",
        2: "text-lg font-semibold text-[var(--text-primary)] mt-5 mb-2.5",
        3: "text-base font-semibold text-[var(--text-primary)] mt-4 mb-2",
        4: "text-[13px] font-semibold text-[var(--text-secondary)] mt-3 mb-1.5",
        5: "text-[13px] font-medium text-[var(--text-tertiary)] mt-2 mb-1",
        6: "text-[11px] font-medium text-[var(--text-tertiary)] mt-2 mb-1",
      };
      elements.push(
        <div key={elements.length} className={sizes[level]}>
          {formatInline(text)}
        </div>
      );
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^\|[\s\-:|]+\|/)) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (row: string) =>
        row.split("|").slice(1, -1).map((c) => c.trim());

      const headers = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).map(parseRow);

      elements.push(
        <div key={elements.length} className="my-3 rounded-md border border-[var(--border-subtle)] overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]/60">
                {headers.map((h, j) => (
                  <th key={j} className="px-3 py-2 text-left text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    {formatInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j} className="border-b border-[var(--border-subtle)]/30 last:border-0">
                  {row.map((cell, k) => (
                    <td key={k} className="px-3 py-2 text-[13px] text-[var(--text-secondary)]">
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (line.match(/^(\s*)[-*]\s/)) {
      const listItems: { indent: number; text: string }[] = [];
      while (i < lines.length && lines[i].match(/^(\s*)[-*]\s/)) {
        const m = lines[i].match(/^(\s*)[-*]\s+(.*)/);
        if (m) listItems.push({ indent: m[1].length, text: m[2] });
        i++;
      }
      elements.push(
        <ul key={elements.length} className="my-2 space-y-1">
          {listItems.map((item, j) => (
            <li
              key={j}
              className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed"
              style={{ paddingLeft: `${item.indent * 8 + 4}px` }}
            >
              <span className="text-[var(--text-muted)] mt-1.5 shrink-0">&#x2022;</span>
              <span>{formatInline(item.text)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s/)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
        const m = lines[i].match(/^\s*\d+\.\s+(.*)/);
        if (m) listItems.push(m[1]);
        i++;
      }
      elements.push(
        <ol key={elements.length} className="my-2 space-y-1 list-decimal list-inside">
          {listItems.map((item, j) => (
            <li key={j} className="text-[13px] text-[var(--text-secondary)] leading-relaxed pl-1">
              {formatInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(<hr key={elements.length} className="my-4 border-[var(--border-subtle)]" />);
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^[-*]\s/) &&
      !lines[i].match(/^\d+\.\s/) &&
      !lines[i].match(/^---+$/) &&
      !(lines[i].includes("|") && i + 1 < lines.length && lines[i + 1]?.match(/^\|[\s\-:|]+\|/))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    elements.push(
      <p key={elements.length} className="text-[13px] text-[var(--text-secondary)] leading-relaxed my-2">
        {formatInline(paraLines.join(" "))}
      </p>
    );
  }

  return <div className="prose-custom">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  // Process inline markdown: bold, italic, code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code key={key++} className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[12px] text-amber-300/90 font-mono">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold + italic
    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalicMatch) {
      parts.push(<strong key={key++} className="font-bold italic text-[var(--text-primary)]">{boldItalicMatch[1]}</strong>);
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++} className="font-semibold text-[var(--text-primary)]">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      parts.push(<em key={key++} className="italic text-[var(--text-primary)]">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      parts.push(
        <span key={key++} className="text-[var(--accent-text)] underline underline-offset-2 decoration-[var(--accent-muted)]">
          {linkMatch[1]}
        </span>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text (advance to next special char or end)
    const nextSpecial = remaining.search(/[`*\[]/);
    if (nextSpecial === 0) {
      // Special char that didn't match any pattern — just emit it
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(remaining);
      remaining = "";
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  return (
    <div className={activeTab === "claude-md" ? "max-w-5xl mx-auto" : "max-w-3xl mx-auto"}>
      <h1 className="text-xl font-bold text-[var(--text-primary)] mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.key
                ? "border-[var(--accent)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "users" && <UserManagementTab />}
      {activeTab === "api-keys" && <ApiKeysTab />}
      {activeTab === "claude-md" && <ClaudeMdTab />}
    </div>
  );
}

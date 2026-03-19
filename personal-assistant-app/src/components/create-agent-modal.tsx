"use client";

import { useState, useCallback, useEffect } from "react";
import { TOOL_DESCRIPTIONS } from "@/lib/tool-descriptions";
import { XIcon, CheckIcon, ChevronLeftIcon } from "@/components/icons";

// All available SDK tools, grouped by category
const TOOL_CATALOG = [
  {
    label: "Core",
    tools: [
      { name: "Read", hint: TOOL_DESCRIPTIONS.Read },
      { name: "Write", hint: TOOL_DESCRIPTIONS.Write },
      { name: "Edit", hint: TOOL_DESCRIPTIONS.Edit },
      { name: "Bash", hint: TOOL_DESCRIPTIONS.Bash },
      { name: "Glob", hint: TOOL_DESCRIPTIONS.Glob },
      { name: "Grep", hint: TOOL_DESCRIPTIONS.Grep },
    ],
  },
  {
    label: "Web",
    tools: [
      { name: "WebSearch", hint: TOOL_DESCRIPTIONS.WebSearch },
      { name: "WebFetch", hint: TOOL_DESCRIPTIONS.WebFetch },
    ],
  },
  {
    label: "Agent",
    tools: [
      { name: "Agent", hint: TOOL_DESCRIPTIONS.Agent },
      { name: "Task", hint: TOOL_DESCRIPTIONS.Task },
    ],
  },
  {
    label: "Notebook",
    tools: [
      { name: "NotebookEdit", hint: TOOL_DESCRIPTIONS.NotebookEdit },
    ],
  },
  {
    label: "MCP",
    tools: [
      { name: "Mcp", hint: TOOL_DESCRIPTIONS.Mcp },
      { name: "ListMcpResources", hint: TOOL_DESCRIPTIONS.ListMcpResources },
      { name: "ReadMcpResource", hint: TOOL_DESCRIPTIONS.ReadMcpResource },
    ],
  },
  {
    label: "User",
    tools: [
      { name: "AskUserQuestion", hint: TOOL_DESCRIPTIONS.AskUserQuestion },
    ],
  },
] as const;

const TOOL_PRESETS: Record<string, string[]> = {
  "Researcher": ["Read", "WebSearch", "WebFetch", "Grep", "Glob"],
  "Coder": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  "Full Access": ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "Agent"],
};

interface McpServer {
  name: string;
  type: "local" | "remote";
}

interface GeneratedAgent {
  name: string;
  description: string;
  tools: string;
  mcpServers: string;
  color: string;
  emoji: string;
  vibe: string;
  content: string;
}

// --- Tool Selector ---

function ToolSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(value.split(",").map((t) => t.trim()).filter(Boolean));

  const toggle = useCallback(
    (name: string) => {
      const next = new Set(selected);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      onChange(Array.from(next).join(", "));
    },
    [selected, onChange]
  );

  const applyPreset = useCallback((presetName: string) => { onChange(TOOL_PRESETS[presetName].join(", ")); }, [onChange]);
  const selectAll = useCallback(() => { onChange(TOOL_CATALOG.flatMap((g) => g.tools.map((t) => t.name)).join(", ")); }, [onChange]);
  const clearAll = useCallback(() => { onChange(""); }, [onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
          Tools ({selected.size})
        </label>
        <div className="flex items-center gap-1">
          {Object.keys(TOOL_PRESETS).map((preset) => (
            <button key={preset} type="button" onClick={() => applyPreset(preset)}
              className="rounded-md px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors">
              {preset}
            </button>
          ))}
          <span className="w-px h-3 bg-[var(--border-subtle)] mx-0.5" />
          <button type="button" onClick={selectAll} className="rounded-md px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors">All</button>
          <button type="button" onClick={clearAll} className="rounded-md px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors">None</button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-3 space-y-2.5">
        {TOOL_CATALOG.map((group) => (
          <div key={group.label}>
            <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-medium">{group.label}</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {group.tools.map((tool) => {
                const isSelected = selected.has(tool.name);
                return (
                  <button key={tool.name} type="button" onClick={() => toggle(tool.name)}
                    className={`group/tool relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--accent-muted)] border-[var(--accent-muted)] text-[var(--accent-text)] hover:bg-[var(--accent-muted)]"
                        : "bg-[var(--bg-base)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:border-[var(--border-default)]"
                    }`}
                  >
                    {isSelected && <CheckIcon size={10} />}
                    {tool.name}
                    {tool.hint && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-[#111113] border border-[var(--border-default)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] font-sans font-normal opacity-0 group-hover/tool:opacity-100 transition-opacity shadow-lg z-50">
                        {tool.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MCP Server Selector ---

function McpServerSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    fetch("/api/agents/main/capabilities")
      .then((r) => r.json())
      .then((data) => { if (data.mcpServers) setServers(data.mcpServers); })
      .catch(() => {});
  }, []);

  const selected = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
  const toggle = useCallback((name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(Array.from(next).join(", "));
  }, [selected, onChange]);

  const selectAll = useCallback(() => { onChange(servers.map((s) => s.name).join(", ")); }, [servers, onChange]);
  const clearAll = useCallback(() => { onChange(""); }, [onChange]);

  if (servers.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">MCP Servers ({selected.size})</label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={selectAll} className="rounded-md px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors">All</button>
          <button type="button" onClick={clearAll} className="rounded-md px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors">None</button>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-3">
        <div className="flex flex-wrap gap-1.5">
          {servers.map((server) => {
            const isSelected = selected.has(server.name);
            return (
              <button key={server.name} type="button" onClick={() => toggle(server.name)}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
                  isSelected
                    ? "border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/15"
                    : "bg-[var(--bg-base)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:border-[var(--border-default)]"
                }`}
              >
                {isSelected && <CheckIcon size={10} />}
                <span className={`text-[9px] opacity-50 ${isSelected ? "" : "hidden"}`}>{server.type === "remote" ? "CLOUD" : "LOCAL"}</span>
                {server.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- Main Modal ---

type Step = "prompt" | "generating" | "review" | "saving";

export function CreateAgentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [agent, setAgent] = useState<GeneratedAgent | null>(null);

  const reset = () => { setStep("prompt"); setPrompt(""); setError(""); setAgent(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStep("generating");
    setError("");
    try {
      const res = await fetch("/api/ai/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to generate agent"); }
      const data = await res.json();
      setAgent({ mcpServers: "", ...data });
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("prompt");
    }
  };

  const handleSave = async () => {
    if (!agent) return;
    setStep("saving");
    setError("");
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to create agent"); }
      onCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("review");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-[560px] max-h-[85vh] overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[#111113] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Create Agent</h2>
          <button onClick={handleClose} className="flex items-center justify-center h-6 w-6 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
            <XIcon size={14} />
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Prompt */}
          {(step === "prompt" || step === "generating") && (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-2">What should this agent do?</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Research competitors and summarize their pricing pages..."
                  rows={4}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-4 py-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none leading-relaxed placeholder-[var(--text-muted)]"
                  disabled={step === "generating"}
                  autoFocus
                />
              </div>
              {error && <p className="text-[12px] text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={handleClose} className="rounded-md px-4 py-2 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">Cancel</button>
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || step === "generating"}
                  className="rounded-md bg-[var(--accent)] px-5 py-2 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {step === "generating" ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Generating...
                    </>
                  ) : "Generate Agent"}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Review & Edit */}
          {(step === "review" || step === "saving") && agent && (
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-raised)] p-4">
                <div className="flex items-start gap-3">
                  <input value={agent.emoji} onChange={(e) => setAgent({ ...agent, emoji: e.target.value })}
                    className="w-12 h-10 text-center text-2xl rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] shrink-0"
                    maxLength={4} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <input value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                      className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-[14px] font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]" />
                    <input value={agent.vibe} onChange={(e) => setAgent({ ...agent, vibe: e.target.value })} placeholder="Vibe / tagline..."
                      className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-[12px] italic text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)] placeholder-[var(--text-muted)]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">Description</label>
                <textarea value={agent.description} onChange={(e) => setAgent({ ...agent, description: e.target.value })} rows={2}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2 text-[13px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)] resize-none leading-relaxed" />
              </div>

              <ToolSelector value={agent.tools} onChange={(tools) => setAgent({ ...agent, tools })} />
              <McpServerSelector value={agent.mcpServers} onChange={(mcpServers) => setAgent({ ...agent, mcpServers })} />

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">Color</label>
                <div className="flex items-center gap-2">
                  <input value={agent.color} onChange={(e) => setAgent({ ...agent, color: e.target.value })}
                    className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-1.5 text-[12px] text-[var(--text-tertiary)] outline-none focus:border-[var(--border-focus)]" />
                  <span className="h-7 w-7 rounded-md border border-[var(--border-default)] shrink-0" style={{ backgroundColor: agent.color }} />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] block mb-1">System Prompt</label>
                <textarea value={agent.content} onChange={(e) => setAgent({ ...agent, content: e.target.value })} rows={10}
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2 text-[12px] text-[var(--text-tertiary)] outline-none focus:border-[var(--border-focus)] resize-y font-mono leading-relaxed" />
              </div>

              {error && <p className="text-[12px] text-red-400 bg-red-500/10 rounded-md px-3 py-2">{error}</p>}

              <div className="flex justify-between">
                <button onClick={() => { setStep("prompt"); setError(""); }}
                  className="rounded-md px-3 py-2 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1.5">
                  <ChevronLeftIcon size={12} /> Back
                </button>
                <div className="flex gap-2">
                  <button onClick={handleGenerate} disabled={step === "saving"}
                    className="rounded-md border border-[var(--border-default)] px-4 py-2 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-50">
                    Regenerate
                  </button>
                  <button onClick={handleSave} disabled={step === "saving" || !agent.name.trim()}
                    className="rounded-md bg-[var(--accent)] px-5 py-2 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 flex items-center gap-2">
                    {step === "saving" ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        Creating...
                      </>
                    ) : "Create Agent"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { SkillInfo } from "@/lib/capabilities";
import {
  SearchIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  CheckIcon,
  PenIcon,
  BuildingIcon,
  RefreshIcon,
  FlaskIcon,
  UserIcon,
  ChartIcon,
  DatabaseIcon,
  WrenchIcon,
  PackageIcon,
} from "@/components/icons";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "Content": PenIcon,
  "Google Workspace": BuildingIcon,
  "Workflows": RefreshIcon,
  "Recipes": FlaskIcon,
  "Personas": UserIcon,
  "Analytics": ChartIcon,
  "Data": DatabaseIcon,
  "Development": WrenchIcon,
  "Other": PackageIcon,
};

const CATEGORY_ORDER = [
  "Content", "Google Workspace", "Workflows", "Recipes",
  "Personas", "Analytics", "Data", "Development", "Other",
];

export function SkillsBrowser() {
  const [skills, setSkills] = useState<SkillInfo[] | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data: SkillInfo[]) => setSkills(data));
  }, []);

  const loadSkillContent = useCallback((slug: string) => {
    setSelectedSkill(slug);
    setLoadingContent(true);
    setEditing(false);
    setSaveStatus("idle");
    fetch(`/api/skills/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setSkillContent(data.content || "");
        setEditContent(data.content || "");
        setLoadingContent(false);
      })
      .catch(() => {
        setSkillContent(null);
        setLoadingContent(false);
      });
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  const handleSave = async () => {
    if (!selectedSkill) return;
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/skills/${selectedSkill}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setSkillContent(editContent);
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
    setSelectedSkill(null);
    setSkillContent(null);
    setEditing(false);
    setSaveStatus("idle");
  };

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (!skills) {
    return (
      <div>
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">Skills</h1>
        <div className="space-y-2 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-[var(--bg-raised)]" />
          ))}
        </div>
      </div>
    );
  }

  // Group by category
  const categories = skills.reduce<Record<string, SkillInfo[]>>((acc, skill) => {
    (acc[skill.category] ||= []).push(skill);
    return acc;
  }, {});
  const sortedCategories = CATEGORY_ORDER.filter((c) => categories[c]);

  // Filter by search
  const q = searchQuery.toLowerCase();
  const getFilteredSkills = (cat: string) => {
    const items = categories[cat] || [];
    if (!q) return items;
    return items.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  };

  const selectedSkillInfo = skills.find((s) => s.slug === selectedSkill);

  // ---- Detail View ----
  if (selectedSkill) {
    return (
      <div ref={detailRef} className="flex flex-col" style={{ height: "calc(100vh - 6rem)" }}>
        {/* Top bar */}
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
                {selectedSkillInfo?.name || selectedSkill}
              </h1>
              {selectedSkillInfo?.description && (
                <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 truncate">{selectedSkillInfo.description}</p>
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
                  onClick={() => { setEditing(false); setEditContent(skillContent || ""); }}
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

        {/* Slug path */}
        <div className="mb-3 shrink-0">
          <code className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-raised)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">
            .claude/skills/{selectedSkill}/SKILL.md
          </code>
        </div>

        {/* Content area */}
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
              {skillContent}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ---- Browse View ----
  const totalFiltered = sortedCategories.reduce((sum, cat) => sum + getFilteredSkills(cat).length, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Skills</h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            {q ? `${totalFiltered} of ${skills.length}` : `${skills.length} skills`}
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

      {/* Categories */}
      <div className="space-y-1">
        {sortedCategories.map((cat) => {
          const items = getFilteredSkills(cat);
          if (!items.length) return null;
          const CatIcon = CATEGORY_ICONS[cat] || PackageIcon;
          const isCollapsed = collapsed[cat] ?? false;

          return (
            <div key={cat}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors group"
              >
                <ChevronDownIcon
                  size={12}
                  className={`text-[var(--text-muted)] transition-transform duration-150 ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <CatIcon size={14} className="text-[var(--text-tertiary)] opacity-70" />
                <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                  {cat}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{items.length}</span>
              </button>

              {/* Skill rows */}
              {!isCollapsed && (
                <div className="ml-[26px] border-l border-[var(--border-subtle)]">
                  {items.map((skill) => (
                    <button
                      key={skill.slug}
                      onClick={() => loadSkillContent(skill.slug)}
                      className="group/item flex items-center gap-2 w-full text-left pl-4 pr-2 py-1.5 hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <span className="text-[13px] text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors truncate flex-1">
                        {skill.name}
                      </span>
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
            <p className="text-[13px] text-[var(--text-tertiary)]">No skills match &ldquo;{searchQuery}&rdquo;</p>
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

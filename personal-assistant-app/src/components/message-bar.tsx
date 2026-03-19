"use client";

import { useEffect, useRef, useState } from "react";
import { PaperclipIcon, SendIcon, StopIcon, XIcon, ImageIcon, FileIcon } from "@/components/icons";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/webp,text/markdown,.md";

interface MessageBarProps {
  onSend: (message: string, files?: File[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  isRunning?: boolean;
  placeholder?: string;
}

export function MessageBar({ onSend, onStop, disabled, isRunning, placeholder }: MessageBarProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    onSend(trimmed, files.length > 0 ? files : undefined);
    setValue("");
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-focus on mount and when a run completes
  useEffect(() => {
    if (!isRunning) {
      textareaRef.current?.focus();
    }
  }, [isRunning]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const hasContent = value.trim().length > 0 || files.length > 0;

  return (
    <div className="bg-[var(--bg-base)] px-4 pb-2 pt-1">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-raised)] overflow-hidden">
          {/* File chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-0">
              {files.map((f, i) => {
                const isImage = f.type.startsWith("image/");
                return (
                  <span
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-1 text-[12px] text-[var(--text-secondary)]"
                  >
                    {isImage ? <ImageIcon size={12} className="text-[var(--text-muted)]" /> : <FileIcon size={12} className="text-[var(--text-muted)]" />}
                    <span className="truncate max-w-[140px]">{f.name}</span>
                    <button
                      onClick={() => removeFile(i)}
                      className="ml-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                      type="button"
                    >
                      <XIcon size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Textarea */}
          <div className="flex items-end gap-2 px-4 pt-2.5 pb-1.5">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Message..."}
              disabled={isRunning}
              rows={1}
              className="flex-1 resize-none bg-transparent text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:outline-none focus-visible:outline-none leading-relaxed max-h-[200px] disabled:opacity-50"
            />
          </div>

          {/* Bottom row: attach + send */}
          <div className="flex items-center justify-between px-3 pb-2 pt-0">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
                  files.length > 0
                    ? "text-[var(--accent-text)] hover:bg-[var(--bg-hover)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
                }`}
                aria-label="Attach file"
                type="button"
              >
                <PaperclipIcon size={16} />
              </button>
            </div>

            {isRunning && onStop ? (
              <button
                onClick={onStop}
                className="flex items-center justify-center h-7 w-7 rounded-md transition-all bg-red-500/80 text-white hover:bg-red-500"
                aria-label="Stop"
              >
                <StopIcon size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!hasContent || disabled}
                className={`flex items-center justify-center h-7 w-7 rounded-md transition-all ${
                  hasContent && !disabled
                    ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    : "text-[var(--text-muted)]"
                }`}
                aria-label="Send message"
              >
                <SendIcon size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

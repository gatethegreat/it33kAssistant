/**
 * Typewriter animation engine for text diffs.
 * Drives a textarea through delete → insert transitions for each changed region.
 */

import { computeLineDiff, type DiffOp } from "./line-diff";

interface AnimateOptions {
  /** Ms per character batch during deletion (default 1) */
  deleteSpeed?: number;
  /** Ms per character batch during insertion (default 2) */
  typeSpeed?: number;
  /** Characters per animation frame (default 4) */
  batchSize?: number;
  /** AbortSignal to cancel the animation */
  signal?: AbortSignal;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, ms)));
}

/**
 * Animate the transition from oldText to newText in a textarea.
 * Calls onContentChange on every frame so React state stays in sync.
 * Returns the final text (always newText unless aborted).
 */
export async function animateDiff(
  textarea: HTMLTextAreaElement | null,
  oldText: string,
  newText: string,
  onContentChange: (text: string) => void,
  options: AnimateOptions = {}
): Promise<string> {
  const {
    deleteSpeed = 1,
    typeSpeed = 2,
    batchSize = 4,
    signal,
  } = options;

  if (!textarea || oldText === newText) {
    onContentChange(newText);
    return newText;
  }

  const ops = computeLineDiff(oldText, newText);

  // Flatten ops into an animation plan: list of { charOffset, action } sequences
  // We'll work through the current text, applying ops one by one.
  let currentText = oldText;
  let cursor = 0; // character position in currentText

  for (const op of ops) {
    if (signal?.aborted) break;

    if (op.type === "keep") {
      // Advance cursor past these lines + the \n joining to next
      cursor += op.text.length;
      // Account for the \n between this keep block and the next op
      if (cursor < currentText.length && currentText[cursor] === "\n") {
        cursor += 1;
      }
      continue;
    }

    if (op.type === "delete" || op.type === "replace") {
      const deleteText = op.type === "delete" ? op.text : op.oldText;
      // Also account for the trailing newline that separates this block
      let deleteLen = deleteText.length;
      // Check if there's a \n after this block that should also be removed
      if (cursor + deleteLen < currentText.length && currentText[cursor + deleteLen] === "\n") {
        deleteLen += 1;
      }

      // Delete phase: remove characters from end of region backward
      let remaining = deleteLen;
      while (remaining > 0 && !signal?.aborted) {
        const chunk = Math.min(batchSize, remaining);
        const deleteAt = cursor + remaining - chunk;
        currentText =
          currentText.slice(0, deleteAt) + currentText.slice(deleteAt + chunk);
        remaining -= chunk;
        onContentChange(currentText);
        // Position cursor in textarea
        textarea.value = currentText;
        textarea.selectionStart = textarea.selectionEnd = cursor;
        scrollToCursor(textarea, cursor);
        await delay(deleteSpeed);
      }

      if (op.type === "replace") {
        // Insert phase: type new text character by character
        const insertText = op.newText + (deleteLen > op.oldText.length ? "\n" : "");
        let inserted = 0;
        while (inserted < insertText.length && !signal?.aborted) {
          const chunk = Math.min(batchSize, insertText.length - inserted);
          const chars = insertText.slice(inserted, inserted + chunk);
          currentText =
            currentText.slice(0, cursor + inserted) +
            chars +
            currentText.slice(cursor + inserted);
          inserted += chunk;
          onContentChange(currentText);
          textarea.value = currentText;
          textarea.selectionStart = textarea.selectionEnd = cursor + inserted;
          scrollToCursor(textarea, cursor + inserted);
          await delay(typeSpeed);
        }
        cursor += insertText.length;
      }
      continue;
    }

    if (op.type === "insert") {
      // Pure insertion — add a newline before if needed
      const prefix = cursor > 0 && currentText[cursor - 1] !== "\n" ? "\n" : "";
      const insertText = prefix + op.text + "\n";
      let inserted = 0;
      while (inserted < insertText.length && !signal?.aborted) {
        const chunk = Math.min(batchSize, insertText.length - inserted);
        const chars = insertText.slice(inserted, inserted + chunk);
        currentText =
          currentText.slice(0, cursor + inserted) +
          chars +
          currentText.slice(cursor + inserted);
        inserted += chunk;
        onContentChange(currentText);
        textarea.value = currentText;
        textarea.selectionStart = textarea.selectionEnd = cursor + inserted;
        scrollToCursor(textarea, cursor + inserted);
        await delay(typeSpeed);
      }
      cursor += insertText.length;
      continue;
    }
  }

  // Safety: ensure we land exactly on newText
  onContentChange(newText);
  if (textarea) textarea.value = newText;
  return newText;
}

function scrollToCursor(textarea: HTMLTextAreaElement, cursorPos: number) {
  // Approximate line from cursor position
  const textBefore = textarea.value.slice(0, cursorPos);
  const lineNumber = textBefore.split("\n").length;
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
  const targetScroll = lineNumber * lineHeight - textarea.clientHeight / 2;
  if (Math.abs(textarea.scrollTop - targetScroll) > lineHeight * 3) {
    textarea.scrollTop = Math.max(0, targetScroll);
  }
}

/** Quick check: does the diff have any actual changes? */
export function hasChanges(ops: DiffOp[]): boolean {
  return ops.some((op) => op.type !== "keep");
}

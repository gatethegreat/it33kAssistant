/**
 * Lightweight line-level diff using LCS (longest common subsequence).
 * No external dependencies. Designed for CLAUDE.md files (~50-300 lines).
 */

export type DiffOp =
  | { type: "keep"; text: string }
  | { type: "delete"; text: string }
  | { type: "insert"; text: string }
  | { type: "replace"; oldText: string; newText: string };

export function computeLineDiff(oldText: string, newText: string): DiffOp[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce raw ops
  const raw: { type: "keep" | "delete" | "insert"; line: string }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      raw.push({ type: "keep", line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: "insert", line: newLines[j - 1] });
      j--;
    } else {
      raw.push({ type: "delete", line: oldLines[i - 1] });
      i--;
    }
  }
  raw.reverse();

  // Merge consecutive ops of the same type, then collapse adjacent delete+insert into replace
  const merged: DiffOp[] = [];
  let idx = 0;
  while (idx < raw.length) {
    const op = raw[idx];

    if (op.type === "keep") {
      // Collect consecutive keeps
      const lines: string[] = [op.line];
      idx++;
      while (idx < raw.length && raw[idx].type === "keep") {
        lines.push(raw[idx].line);
        idx++;
      }
      merged.push({ type: "keep", text: lines.join("\n") });
    } else if (op.type === "delete") {
      // Collect consecutive deletes
      const delLines: string[] = [op.line];
      idx++;
      while (idx < raw.length && raw[idx].type === "delete") {
        delLines.push(raw[idx].line);
        idx++;
      }
      // Check if followed by inserts → replace
      if (idx < raw.length && raw[idx].type === "insert") {
        const insLines: string[] = [];
        while (idx < raw.length && raw[idx].type === "insert") {
          insLines.push(raw[idx].line);
          idx++;
        }
        merged.push({ type: "replace", oldText: delLines.join("\n"), newText: insLines.join("\n") });
      } else {
        merged.push({ type: "delete", text: delLines.join("\n") });
      }
    } else {
      // insert (not preceded by delete)
      const lines: string[] = [op.line];
      idx++;
      while (idx < raw.length && raw[idx].type === "insert") {
        lines.push(raw[idx].line);
        idx++;
      }
      merged.push({ type: "insert", text: lines.join("\n") });
    }
  }

  return merged;
}

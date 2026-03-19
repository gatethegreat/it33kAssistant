#!/bin/bash
# Auto-format files after Claude edits them
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXT="${FILE_PATH##*.}"

case "$EXT" in
  py)
    if command -v ruff &>/dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null
    fi
    ;;
  js|ts|jsx|tsx|json|css|html|md|yaml|yml)
    if command -v npx &>/dev/null; then
      npx prettier --write "$FILE_PATH" 2>/dev/null
    fi
    ;;
esac

exit 0

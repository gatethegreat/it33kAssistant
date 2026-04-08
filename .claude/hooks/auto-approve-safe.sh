#!/bin/bash
# Auto-approve safe, read-only bash commands (reduces permission fatigue)
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

SAFE_PATTERNS=(
  "^ls "
  "^ls$"
  "^pwd$"
  "^git status"
  "^git log"
  "^git diff"
  "^git branch"
  "^cat "
  "^head "
  "^tail "
  "^wc "
  "^which "
  "^echo "
  "^npx gws "
  "^python3 scripts/lib/"
  "^python3 /mnt/.*/scripts/lib/"
  "^npm list"
  "^node -"
  "^jq "
)

for pattern in "${SAFE_PATTERNS[@]}"; do
  if echo "$CMD" | grep -qE "$pattern"; then
    exit 0
  fi
done

exit 0

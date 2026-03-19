#!/bin/bash
# Block destructive bash commands
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

DANGEROUS_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "git reset --hard"
  "git push.*--force"
  "git push.*-f "
  "git clean -f"
  "git checkout \."
  "git restore \."
  "DROP TABLE"
  "DROP DATABASE"
  "TRUNCATE"
  "> /dev/sda"
)

CMD_LOWER=$(echo "$CMD" | tr '[:upper:]' '[:lower:]')

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  pattern_lower=$(echo "$pattern" | tr '[:upper:]' '[:lower:]')
  if echo "$CMD_LOWER" | grep -qE "$pattern_lower"; then
    echo "Blocked: destructive command detected matching '$pattern'" >&2
    exit 2
  fi
done

exit 0

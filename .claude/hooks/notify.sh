#!/bin/bash
# Desktop notification when Claude needs attention (WSL2 compatible)
# Uses powershell.exe toast notifications on Windows/WSL2

MESSAGE="Claude Code needs your attention"
INPUT=$(cat)
TYPE=$(echo "$INPUT" | jq -r '.hook_event_name // "Notification"')

if [ "$TYPE" = "Notification" ]; then
  SUBTYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
  case "$SUBTYPE" in
    permission_prompt) MESSAGE="Claude needs permission" ;;
    idle_prompt) MESSAGE="Claude is waiting for input" ;;
    *) MESSAGE="Claude Code notification" ;;
  esac
fi

# WSL2: use PowerShell toast notification
if command -v powershell.exe &>/dev/null; then
  powershell.exe -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); \$n = New-Object System.Windows.Forms.NotifyIcon; \$n.Icon = [System.Drawing.SystemIcons]::Information; \$n.Visible = \$true; \$n.ShowBalloonTip(5000, 'Claude Code', '$MESSAGE', 'Info'); Start-Sleep -Seconds 6; \$n.Dispose()" &>/dev/null &
# Linux native
elif command -v notify-send &>/dev/null; then
  notify-send "Claude Code" "$MESSAGE" &>/dev/null &
fi

exit 0

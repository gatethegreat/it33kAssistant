#!/bin/bash
# Inject preservation priorities before context compaction
# This tells Claude what to keep when compressing conversation history
cat <<'PRIORITIES'
CRITICAL CONTEXT TO PRESERVE DURING COMPACTION:
- Current task and what step we're on
- Any file paths currently being edited or created
- Google Drive file IDs, doc IDs, or sheet IDs in use
- Calendar event IDs or meeting details being managed
- Email thread IDs or draft IDs in progress
- Research topic and which round of verification we're on
- Any user corrections or feedback given this session
- Action items or deadlines being tracked
PRIORITIES
exit 0

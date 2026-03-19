#!/bin/bash
# Inject preservation priorities before context compaction
# This tells Claude what to keep when compressing conversation history
cat <<'PRIORITIES'
CRITICAL CONTEXT TO PRESERVE DURING COMPACTION:
- Current pipeline step (which of the 8 blog pipeline steps we're on)
- Any WordPress post IDs, draft URLs, or publish URLs
- SEO audit findings not yet applied
- ClickUp task IDs being tracked
- Blog post title and target keyword
- LinkedIn post content if mid-creation
- Any file paths currently being edited
- Brand voice decisions made in this session
- Any user corrections or feedback given this session
PRIORITIES
exit 0

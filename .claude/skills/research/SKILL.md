---
name: research
description: "Use when the user wants to research any topic in depth and get verified results. Triggers on 'research', 'verify this', 'look into', 'dig into', 'find out about'. Spawns Researcher, Challenger, and Fact-Checker agents that loop until all agree or 3 rounds max."
---

# /research — Deep Research with Verification Loop

Spawns three specialized agents that research a topic, then challenge and fact-check the findings in a loop until all agents agree the research is solid.

## Agents

| Agent | Role | File |
|-------|------|------|
| **Researcher** | Deep web research, writes structured findings | `.claude/agents/researcher.md` |
| **Challenger** | Challenges depth, originality, completeness — does its own searches | `.claude/agents/research-challenger.md` |
| **Fact-Checker** | Independently verifies every factual claim | `.claude/agents/research-fact-checker.md` |

## Flow

### Step 1: Setup

1. Parse the topic from user input
2. Create a slug from the topic (e.g., `cloud-cost-optimization`, `vendor-risk-frameworks`)
3. Create the output directory: `research/<slug>/`

### Step 2: Initial Research

Dispatch the **Researcher** agent:

```
Agent(subagent_type="Researcher", prompt="""
Research this topic in depth: <TOPIC>

Write your findings to: <PROJECT_DIR>/research/<SLUG>/research.md

Follow the output format in your instructions. This is Round 1 (initial research).
""")
```

Wait for completion. Read the output file to confirm it was written.

### Step 3: Challenge + Fact-Check (Parallel)

Read `research/<slug>/research.md` and pass its full contents to BOTH agents simultaneously:

```
Agent(subagent_type="Research Challenger", prompt="""
Review this research document and produce a Challenge Report.

<RESEARCH CONTENT>
""")

Agent(subagent_type="Research Fact-Checker", prompt="""
Review this research document and produce a Fact-Check Report.

<RESEARCH CONTENT>
""")
```

Both MUST run in parallel — this is the whole point.

### Step 4: Check Verdicts

- If BOTH return **APPROVED** → go to Step 6 (finalize)
- If EITHER returns **NEEDS REVISION** → go to Step 5 (refine)
- If this is round 3 → go to Step 6 (finalize with notes on unresolved items)

### Step 5: Refine

Pass both reports to the **Researcher** agent:

```
Agent(subagent_type="Researcher", prompt="""
Refine your research based on the Challenger and Fact-Checker feedback below.

Your previous research is at: <PROJECT_DIR>/research/<SLUG>/research.md
Read it, address ALL issues from both reports, and overwrite the file with the improved version.
Update the Status to "Revised" and the Rounds field. Update the Revision Log.

This is Round <N>.

## Challenger Report
<CHALLENGER OUTPUT>

## Fact-Checker Report
<FACT_CHECKER OUTPUT>
""")
```

After refinement, go back to Step 3.

### Step 6: Finalize

1. Update the research document's Status to "Final"
2. Write the last Challenger report to `research/<slug>/challenge-report.md`
3. Write the last Fact-Checker report to `research/<slug>/fact-check-report.md`
4. Report to the user:
   - Topic researched
   - Number of rounds completed
   - Final verdicts from both reviewers
   - Path to output files
   - Quick summary of key findings

## Max Rounds

**3 rounds maximum.** If both agents haven't approved by round 3, finalize anyway and note unresolved items. Genuinely debatable topics may never fully converge — that's fine.

## Output Structure

```
research/<slug>/
  research.md           # Final verified research
  challenge-report.md   # Last challenger report
  fact-check-report.md  # Last fact-checker report
```

## Gotchas

- **Read the research file after each agent writes it.** Don't assume it was written — verify.
- **Pass the full research content to Challenger and Fact-Checker**, not just the file path. They need the content inline to review.
- **The Researcher needs the file path** so it can read and overwrite. The reviewers need the content.
- **Slug collisions:** If `research/<slug>/` already exists, append a date (e.g., `vendor-risk-2026-04-07`).
- **Don't skip parallel dispatch.** Challenger and Fact-Checker MUST run simultaneously.
- **Report round count to the user** so they know it's working, not stuck.
- **No hardcoded paths.** Use the project's working directory as the base.

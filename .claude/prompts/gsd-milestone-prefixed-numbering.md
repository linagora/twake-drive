# GSD Milestone-Prefixed Numbering Convention

## Context

When working on multiple milestones across different git branches, GSD's default sequential phase numbering (1, 2, 3...) causes conflicts when branches are rebased or merged. To prevent this, all phase numbers, plan numbers, and directory names MUST use milestone-prefixed numbering.

## Convention

### Phase numbering
- Format: `{milestone}-{sequence}` where milestone is the version with dot preserved
- Examples for milestone v3.0: phases are `v3.0-01`, `v3.0-02`, `v3.0-03`, `v3.0-04`
- Examples for milestone v2.2: phases are `v2.2-01`, `v2.2-02`
- The sequence resets to 01 for each new milestone

### Plan numbering
- Format: `{phase}-{plan}` — follows naturally from phase prefix
- Examples: `v3.0-01-01-PLAN.md`, `v3.0-01-02-PLAN.md`

### Directory naming
- Format: `.planning/phases/{phase}-{slug}/`
- Examples: `.planning/phases/v3.0-01-scribecontext-panel-shell/`

### Requirement IDs
- Already prefixed by category (PANEL-01, CHAT-01) — no change needed
- But traceability table in REQUIREMENTS.md must reference prefixed phase names

### References in docs
- ROADMAP.md: `Phase v3.0-01: ScribeContext + Panel Shell`
- STATE.md: `Phase: v3.0-01 of v3.0-04`
- depends_on in plan frontmatter: `depends_on: [v3.0-01-01]`
- Success criteria, verification, etc. all use prefixed format

## Task

Execute the following steps ONE AT A TIME. After each step, present your conclusions and STOP. Wait for the user to say "continue" or give feedback before proceeding to the next step.

### Step 1 — Audit

Read ROADMAP.md, STATE.md, REQUIREMENTS.md and scan `.planning/phases/` directories. List all phases, plans, and references that use plain sequential numbers instead of milestone-prefixed numbers.

Present a summary:
- How many phases/plans are affected
- Which milestones they belong to
- Whether any phases already use the correct format

**Then STOP and ask:** "Audit complete. Continue to step 2 (correction plan)?"

### Step 2 — Correction plan

For each finding from step 1, produce a detailed rename table:

| Current | Should be | Locations |
|---------|-----------|-----------|
| Phase 14 | Phase v3.0-01 | ROADMAP.md, STATE.md, ... |

Include:
- Directory renames
- File renames
- Content reference updates (frontmatter, depends_on, file paths, prose)
- Estimated number of edits per file

**Then STOP and ask:** "Correction plan ready. Continue to step 3 (apply changes)?"

### Step 3 — Apply

Rename directories, rename files, update all content references. Commit as a single atomic commit: `docs: apply milestone-prefixed phase numbering convention`.

Present a post-apply verification:
- List of renamed directories and files
- Grep for any remaining old-format references
- Confirmation that all references are consistent

**Then STOP and ask:** "Changes applied and verified. Anything to adjust?"

### Ongoing rule

For new phases going forward: when creating new phases (via /gsd:plan-phase, /gsd:add-phase, /gsd:new-milestone, etc.), always use the milestone-prefixed format. If GSD generates plain sequential numbers, rename immediately after generation before any other work.

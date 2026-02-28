# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** La chaine de communication complete -- depuis la selection de texte dans OnlyOffice jusqu'a la reinjection du texte modifie -- doit fonctionner de bout en bout.
**Current focus:** Phase 1: Plugin OnlyOffice POC (context gathered, ready to plan)

## Current Position

Phase: 1 of 4 (Plugin OnlyOffice POC)
Plan: 0 of 0 in current phase (plans not yet created)
Status: Ready to plan
Last activity: 2026-02-28 -- Phase 1 context gathered

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- POC plugin OnlyOffice en priorite: composant le plus risque, lever les incertitudes en premier
- Communication via postMessage: seul mecanisme standard pour la communication cross-iframe
- Dev environment setup first: must solve Docker plugin mounting, install process, and fast iteration cycle BEFORE writing any plugin code
- Git worktree: all Scribe development in a dedicated worktree to keep main working tree available for other Cozy Drive work
- POC is foundation code: write clean code that evolves into the real plugin
- Plugin has test panel: small panel with Read/Replace/Insert buttons for easy validation
- Incremental validation: each capability tested as built (env -> load -> select -> replace -> insert)

### Pending Todos

None yet.

### Blockers/Concerns

- OO Document Server version on Cozy instances is unknown -- must be determined in Phase 1 before plugin development
- Selection loss when Scribe panel receives focus -- must be reproduced and mitigated in Phase 1 POC
- `callCommand` runs in isolated JS sandbox -- no plugin variables or async operations pass through
- Plugin install process in OO Docker is unknown -- first thing to figure out in Phase 1

## Session Continuity

Last session: 2026-02-28
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-plugin-onlyoffice-poc/01-CONTEXT.md

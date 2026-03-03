---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Scribe Live AI
status: active
last_updated: "2026-03-03T18:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** La chaîne de communication complète — depuis la sélection de texte dans OnlyOffice jusqu'à la réinjection du texte modifié par l'IA — doit fonctionner de bout en bout, de manière transparente pour l'utilisateur.
**Current focus:** v2.0 Scribe Live AI — real Anthropic Claude integration

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-03 — Milestone v2.0 started

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

### Pending Todos (carried from v1.0)

- Fix "Selected Text" white-on-white in OO dark theme (cosmetic)
- Test context menu integration
- Button disable on deselection when no text selected

### Known Technical Constraints

- InsertContent replaces selection (not insert-after) — workaround in place
- Docker volume mount changes file ownership — auto-fixed in setup script
- OO caches plugin config at container startup — must recreate container after config changes
- Plugin code must use ES5 syntax
- cozy-stack already has /ai routes and RAG proxy pattern — extend, don't replace
- Anthropic API key will be global server config (not per-instance)

### Multi-Repo Context

- **cozy-stack** (`~/go/src/github.com/cozy/cozy-stack`): Go — extend web/ai/ routes
- **cozy-drive** (`~/Dev-local/cozy-drive`): React — frontend integration

## Session Continuity

Last session: 2026-03-03
Stopped at: v2.0 milestone initialization

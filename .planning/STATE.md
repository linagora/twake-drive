---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Contrat de réponse structurée LLM
status: executing
stopped_at: Phase v3.1-02 context gathered
last_updated: "2026-06-17T05:20:13.650Z"
last_activity: 2026-06-17 -- Phase v3.1-02 planning complete
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.
**Current focus:** Phase v3.1-02 — Prompt + plumbing (next)

## Current Position

Phase: v3.1-01 (Module contrat) — COMPLETE ✓ (verified 2026-06-16)
Plan: 2 of 2 complete
Status: Ready to execute
Progress: [██        ] 20% (1/5 phases)
Last activity: 2026-06-17 -- Phase v3.1-02 planning complete

Next: `/gsd:discuss-phase v3.1-02` (or `/gsd:plan-phase v3.1-02`)

## v3.1 Roadmap Summary

Execution order (HARD GATE at v3.1-03): v3.1-01 -> v3.1-02 -> v3.1-03 -> v3.1-04 -> v3.1-05

| Phase | Goal | Requirements |
|-------|------|--------------|
| v3.1-01 Module contrat | `scribeResponse.js` pur + testé (parse tolérant, validation maison, repli contextuel, schéma) | CONTRACT-01, CONTRACT-03, CONTRACT-04 |
| v3.1-02 Prompt + plumbing | Prompts contractuels + seam de parse sur les deux surfaces, modèle de message étendu, miroir inline → chat | INLINE-01, INLINE-02 |
| v3.1-03 Sonde dev (HARD GATE) | Panneau dev + métriques de conformité ; gate go/no-go avant tout rendu de cartes | PROBE-01 |
| v3.1-04 Rendu chat (cartes + clavier) | Cartes de fragment, Copier/Insérer/Remplacer, réinjection riche, navigation clavier | CONTRACT-02, FRAG-01..04, KBD-01..04 |
| v3.1-05 Rendu popover + durcissement | Fragment unique dans le popover, re-ask, i18n, corpus de régression, décision flag `response_format` | I18N-01 |

## Post-Milestone Refinements (2026-04-03 to 2026-04-04)

After v3.0-04 completion, three commits refined the plugin protocol and documentation:

1. **89ac98a9c** -- Simplify plugin protocol: remove SHOW/HIDE_SCRIBE_BUTTON polling, replace with SELECTION_CHANGED one-way intent. Remove keyboard shortcut delay. Add focus guard on ChatInput textarea. Instant Popover open (transitionDuration=0). Both floating buttons always visible.
2. **12a48b109** -- Restore full plugin code.js (2800+ lines with v2.5/v2.6 features). Add selection-subscribe protocol (plugin only sends SELECTION_CHANGED when panel is open). Remove popover timer delay.
3. **318a751fc** -- Document patched OO SDK setup and upstream PR dependency in plugin README.

## Performance Metrics

**Velocity:**

- Total plans completed: 24+ (v1.0: 10, v2.0: 5, v2.1: 6, v2.2: 3, v3.0: 7)
- v2.1 average duration: ~5 min/plan
- v2.1 total execution time: ~32 min

**By Phase (v2.1):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 10 Extraction Rich Text | 2 | 4min | 2min |
| 11 Pipeline de Conversion | 2 | 9min | 4.5min |
| 12 Preview Markdown | 1 | 2min | 2min |
| 13 Reinjection Pipeline | 1 | 15min | 15min |

## Accumulated Context

### Decisions (v3.1 locked, from PROJECT.md + research/SUMMARY.md)

- Prompt-only JSON contract (zéro nouvelle dépendance) ; le JSON Schema reste un artefact documenté pour un futur `json_schema`
- Validation maison (~15 LOC) suffit pour un objet à 2 champs ; pas de zod/ajv
- `response_format` et tool/function-calling rejetés par défaut (proxy cozy-stack inconnu) — opt-in derrière flag uniquement après confirmation par la sonde
- Repli contextuel : popover → 1 fragment ; chat → discussion + filet de sécurité
- `discussion` reste free-form (canal CoT) pour éviter la dégradation de prose (~10-15% sous contrainte JSON) ; seuls les `fragments[]` sont contraints
- Marqueurs `{{fragment:N}}` strictement non-chevauchants avec `{{REF:scribe-ref-N:…}}` (test de préservation obligatoire)
- Le risque principal n'est PAS la syntaxe JSON mais la séparation sémantique (duplication / fuite de préambule) — la sonde v3.1-03 gate là-dessus, pas sur « JSON valide »
- Sémantique des fragments : morceaux séquentiels indépendants (insert all à venir en v3.2), pas des alternatives concurrentes
- Réinjection riche existante (tables/footnotes/cell-markers) inchangée, appliquée par fragment

### Recent decisions affecting v3.0 (historique)

- Side panel in Cozy Drive (not OO native plugin) for more UI control and cozy-ui components
- Complementary inline + panel modes (keep quick actions, add chat for longer exchanges)
- ScribeContext provider to centralize state
- [v3.0-02]: Chat system prompt separate from inline SYSTEM_PROMPT
- [v3.0-03]: panelActions bridge pattern -- View.jsx passes respond handlers into ScribeContext for MessageActions
- [v3.0-03]: Rich HTML clipboard copy via ClipboardItem API with text/plain fallback

### Known Technical Constraints

- Plugin code must use ES5 syntax (no arrow functions, no const/let)
- Endpoint OpenAI-compat non streamé ; pas de modification cozy-stack (frontend only)
- Réponses LLM via cozy-stack POST /ai/v1/chat/completions (format OpenAI)
- Prompt côté client : on contrôle l'instruction qui émet le contrat

### Blockers/Concerns

- **Risque sémantique (v3.1-03 gate)** : le modèle peut produire du JSON valide tout en dupliquant le fragment dans `discussion` ou en y laissant fuir un préambule localisé — la sonde doit valider la séparation réelle avant tout rendu de cartes
- Proxy cozy-stack inconnu : ne pas dépendre de `response_format` avant confirmation empirique par la sonde

## Session Continuity

Last session: 2026-06-16T20:52:37.455Z
Stopped at: Phase v3.1-02 context gathered
Resume file: .planning/phases/v3.1-02-prompt-plumbing/v3.1-02-CONTEXT.md

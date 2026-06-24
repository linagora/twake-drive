---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Contexte enrichi du prompt
status: planning
stopped_at: v3.2 milestone started — roadmap created (3 phases), next step is /gsd-plan-phase v3.2-01
last_updated: "2026-06-24T15:00:00.000Z"
last_activity: 2026-06-24 -- Created v3.2 roadmap (Contexte enrichi du prompt): 3 phases (v3.2-01 UX statique / v3.2-02 câblage discussion+sélection / v3.2-03 câblage document complet + taille), 10/10 requirements mapped
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Deferred Items

Items acknowledged and deferred at v3.1 milestone close on 2026-06-24. These are historical open artifacts from already-shipped milestones (verification gaps that were never formally closed) plus one false-positive open flag — none block the v3.1 close:

| Category | Item | Status |
|----------|------|--------|
| verification | phase 21 (v2.1) | human_needed |
| verification | phase 25 (v2.1) | human_needed |
| verification | v3.0-01 (v3.0) | human_needed |
| verification | v3.0-02 (v3.0) | human_needed |
| quick_task | 2-feature-flag-for-scribe | open (false positive — actually completed 2026-03-05) |

Note: the four verification items are pre-existing human-verify gaps inherited from milestones that already shipped; they were acknowledged and deferred at v3.1 milestone close on 2026-06-24. The `2-feature-flag-for-scribe` quick-task is a false-positive open flag (the work was actually completed 2026-03-05) — recorded here for traceability and likewise acknowledged and deferred at v3.1 milestone close on 2026-06-24.

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-24)

**Core value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.
**Current focus:** v3.2 Contexte enrichi du prompt — milestone démarré, planification

## Current Position

Phase: v3.2-01 (Zone « Inclure » discrète — UX statique) — NOT STARTED (next: plan it)
Plan: 0 of 0 (phase not yet planned)
Status: Milestone v3.2 started / planning — roadmap created, no phase planned yet
Progress: [----------] 0% (0/3 v3.2 phases)
Last activity: 2026-06-24 -- Created v3.2 roadmap (Contexte enrichi du prompt)

⚠️ TOOLING: gsd-sdk v1.42.3 cannot resolve `vX.Y-NN` phases (find-phase/phase-plan-index return "Phase not found" for ALL v3.0/v3.1 phases — regex only matches numeric-prefixed dirs). Orchestrate v3.2 phases manually with explicit paths; ROADMAP/STATE/REQUIREMENTS completion writes done by hand (gsd-sdk phase.complete fails on vX.Y-NN).

Next: plan v3.2-01 (`/gsd-plan-phase v3.2-01`). Phase dir to create: `.planning/phases/v3.2-01-inclure-zone-ux/`.

## v3.2 Roadmap Summary

Execution order: v3.2-01 (UX statique) -> v3.2-02 (câblage discussion + sélection) -> v3.2-03 (câblage document complet + stratégie de taille)

| Phase | Goal | Requirements | UI hint |
|-------|------|--------------|---------|
| v3.2-01 Zone « Inclure » discrète (UX statique) | Zone « Inclure » + 3 cases (document/discussion/sélection) au-dessus du prompt, états par défaut, apparition conditionnelle sélection, réutilisation du chip ; aucun câblage LLM | CTX-UX-01..05 | yes |
| v3.2-02 Câblage discussion + sélection | Injection déterministe de la discussion et de la sélection cochées, sans casser le contrat v3.1 | CTX-LLM-02, CTX-LLM-03, CTX-LLM-05 | no |
| v3.2-03 Câblage document complet + stratégie de taille | Nouveau chemin d'extraction document-entier (markdown) + stratégie de troncature documentée + retour utilisateur si tronqué | CTX-LLM-01, CTX-LLM-04 | yes |

## Accumulated Context

### Code anchors (grounding for v3.2)

- **UX (v3.2-01)** : la zone « Inclure » se place dans `src/modules/views/OnlyOffice/Scribe/ChatInput.jsx`, au-dessus du `<textarea>`, là où `SelectionChip` est déjà rendu conditionnellement (`currentSelection &&`). L'état sélection vit dans `ScribeContext` (`currentSelection`, `dismissSelection`). Réutiliser `SelectionChip.jsx` pour la zone d'affichage révélée par la case « sélection ».
- **Câblage discussion/sélection (v3.2-02)** : le point de composition du prompt est `ScribeContext.sendMessage` (assemble le bloc `[Selected text from document]…[End of selected text]` + l'historique via `serializeAssistantTurnForHistory`) et `scribeAI.encodeSelectionForPrompt` / `buildChatSystemPrompt`. La sélection est déjà encodée — le câblage consiste surtout à gater son inclusion par la case. L'historique est déjà sérialisé discussion-seulement.
- **Câblage document complet (v3.2-03)** : ⚠️ il N'EXISTE PAS de chemin d'extraction document-entier. Le plugin `plugins/onlyoffice-scribe/scripts/code.js` n'extrait que la SÉLECTION (via `GetRangeBySelect`), mais possède déjà l'émetteur markdown par-élément (`Api.GetDocument().GetAllParagraphs()` + tables/footnotes, l.627+). CTX-LLM-01 exige un NOUVEAU chemin plugin scannant tout le document en réutilisant cet émetteur — d'où l'isolement de la phase et de la stratégie de taille (CTX-LLM-04). Plugin = ES5 strict (pas d'arrow/const/let).
- **Contrat v3.1 à ne pas casser** : `scribeResponse.js` (parse/validation/repli), `callScribeAIWithReask` (re-ask unique). Les contextes injectés ne doivent jamais fuiter dans `fragments` ni perturber la séparation discussion/fragments. Corpus de régression + sonde (`scribeProbe.js`) doivent rester verts.

### Decisions (v3.2 roadmap)

- 3 phases : UX statique d'abord (contrainte du seed projet « UX FIRST »), puis 2 phases de câblage SÉPARÉES (sources bon-marché in-memory vs document complet)
- Découpage du câblage par coût/risque : v3.2-02 = discussion + sélection (déjà en mémoire, encodage déjà existant) ; v3.2-03 = document complet (nouveau chemin d'extraction plugin + stratégie de taille/troncature) — le risque et la nouveauté technique se concentrent sur le docx, justifiant son isolement
- CTX-UX-05 (discrétion visuelle) traité comme critère de succès de v3.2-01, pas comme phase séparée
- i18n des libellés « Inclure » intégrée à v3.2-01 (5 locales fr/en/de/es/it, zéro chaîne en dur) — cohérent avec la dette i18n fermée en v3.1

### Known Technical Constraints

- Plugin code must use ES5 syntax (no arrow functions, no const/let)
- Endpoint OpenAI-compat non streamé ; pas de modification cozy-stack (frontend only)
- Réponses LLM via cozy-stack POST /ai/v1/chat/completions (format OpenAI)
- Le contrat de réponse v3.1 (`scribeResponse.js`) est figé — toute injection de contexte doit le préserver

## Session Continuity

Last session: 2026-06-24T15:00:00.000Z
Stopped at: Created v3.2 roadmap (ROADMAP.md Phase Details + Progress rows, REQUIREMENTS.md traceability, PROJECT.md Next Milestone Goals, STATE.md reset). No phase planned yet.
Resume file: milestone v3.2 is in planning — next step `/gsd-plan-phase v3.2-01`. ⚠️ gsd-sdk v1.42.3 still cannot resolve vX.Y-NN phases; orchestrate manually with explicit paths.

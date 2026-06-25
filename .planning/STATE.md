---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Contexte enrichi du prompt
status: executing
stopped_at: v3.2-02 context gathered (discuss-phase). CONTEXT.md + DISCUSSION-LOG.md written & committed. Ready to plan v3.2-02.
last_updated: "2026-06-25T00:00:00.000Z"
last_activity: 2026-06-25 -- Gathered Phase v3.2-02 context (câblage discussion + sélection): D-00 γ + D-05 framing, D-01..D-04 wiring decisions
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 1
  completed_plans: 1
  percent: 33
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
**Current focus:** Phase v3.2-01 — Zone Inclure discrète (UX statique)

## Current Position

Phase: v3.2-02 (Câblage discussion + sélection) — CONTEXT GATHERED (discuss-phase done)
Plan: not yet created
Status: v3.2-02 context captured — ready to plan
Progress: [###-------] 33% (1/3 v3.2 phases complete; v3.2-02 in discuss→plan)
Last activity: 2026-06-25 -- Gathered Phase v3.2-02 context (D-00 γ + framing, D-01..D-04)

⚠️ TOOLING: gsd-sdk v1.42.3 cannot resolve `vX.Y-NN` phases (find-phase/phase-plan-index return "Phase not found" for ALL v3.0/v3.1 phases — regex only matches numeric-prefixed dirs). Orchestrate v3.2 phases manually with explicit paths; ROADMAP/STATE/REQUIREMENTS completion writes done by hand (gsd-sdk phase.complete fails on vX.Y-NN).

Next: plan v3.2-02 — câblage discussion + sélection. CONTEXT.md is ready at `.planning/phases/v3.2-02-cablage-discussion-selection/v3.2-02-CONTEXT.md`. ⚠️ gsd-sdk does NOT resolve `vX.Y-NN` slugs (confirmed: init.plan-phase / roadmap.get-phase / init.phase-op all return phase_found=false on the full slug; only the abbreviated `v3.2-02` resolves in roadmap.get-phase, and its auto-slug mangles accents → orchestrate plan-phase MANUALLY with explicit phase_dir `.planning/phases/v3.2-02-cablage-discussion-selection`). The three include booleans live in ScribeContext (l.65-67); v3.2-02 reads them at the `sendMessage` prompt-assembly seam (l.164). Key locked decisions in CONTEXT.md: D-00 γ (gate v3.1 structure + seam ready for v3.2-03), D-05 light system-prompt framing, D-01 discussion-off⇒current-turn-only, D-02 selection gates current turn only, D-03 store-only-what-is-sent (no checkbox flags), D-04 selection-off removes block AND marker clauses.

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

Last session: 2026-06-25
Stopped at: v3.2-02 discuss-phase DONE — CONTEXT.md + DISCUSSION-LOG.md written & committed (commit e77dd2c6f). 5 gray areas discussed; all decisions locked (see CONTEXT.md D-00..D-05). Next step → plan v3.2-02 (NO UI hint → skip ui-phase).
Resume file: `.planning/phases/v3.2-02-cablage-discussion-selection/v3.2-02-CONTEXT.md`.
⚠️ TOOLING CORRECTION (supersedes prior note): gsd-sdk does NOT resolve `vX.Y-NN` slugs end-to-end. Confirmed 2026-06-25: `init.plan-phase` / `init.phase-op` / `roadmap.get-phase` ALL return phase_found=false on the full slug `v3.2-02-cablage-discussion-selection`; only the abbreviated `v3.2-02` resolves in `roadmap.get-phase` (found=true), but its auto-generated `expected_phase_dir` mangles accents (`v3.2-02-c-blage-discussion-s-lection`). So: orchestrate plan-phase MANUALLY with explicit phase_dir = `.planning/phases/v3.2-02-cablage-discussion-selection`, pass abbreviated `v3.2-02` to `roadmap.get-phase` for goal/criteria, and write completion docs by hand. See [[milestone-prefixed-numbering-convention]].
v3.2-02 reads the three include booleans from ScribeContext (l.65-67) at the `sendMessage` prompt-assembly seam (l.164, comment `read by v3.2-02/03; no prompt injection in v3.2-01`). The uncommitted `plugins/onlyoffice-scribe/scripts/code.js` is the selection-cases-harness chantier's dev hooks — leave it; NOT part of v3.2.
Env after reboot: OO container + cozy-stack must be up; Drive `src/` changes need `yarn build` then hard-reload (NOT an OO restart). The uncommitted `plugins/onlyoffice-scribe/scripts/code.js` is the selection-cases-harness chantier's dev hooks — leave it; NOT part of v3.2.

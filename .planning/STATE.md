---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Contexte enrichi du prompt
status: executing
stopped_at: v3.2-02 EXECUTED + VERIFIED (passed, 10/10 must-haves). Gated discussion+selection at the ScribeContext.sendMessage seam (live-read refs, D-01..D-05), D-05 framing seed in buildChatSystemPrompt; deterministic compose matrix + v3.1 regression/PROBE-01 all GREEN; v3.1 contract artifacts confirmed unmodified. Code review WR-01/WR-02 (dev-only probe/panel divergence) fixed in b1b11bb5f. Next → v3.2-03 (câblage document complet + stratégie de taille).
last_updated: "2026-06-25T17:05:00Z"
last_activity: 2026-06-25 -- Phase v3.2-02 complete (verified passed)
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 1
  completed_plans: 1
  percent: 67
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
**Current focus:** Phase v3.2-03 — Câblage document complet + stratégie de taille (CONTEXT gathered → plan/ui next)

## Current Position

Phase: v3.2-02 (Câblage discussion + sélection) — ✅ COMPLETE (verified passed 10/10, 2026-06-25)
Plan: v3.2-02-01 complete — SUMMARY + VERIFICATION written; 5 commits (f85d1a39b, 34768c15f, 9935423d7, 7dd025996, + fix b1b11bb5f)
Status: Phase complete — next is v3.2-03
Progress: [#######---] 67% (2/3 v3.2 phases complete)
Last activity: 2026-06-25 -- Phase v3.2-02 executed + verified passed

⚠️ TOOLING: gsd-sdk v1.42.3 cannot resolve `vX.Y-NN` phases (find-phase/phase-plan-index return "Phase not found" for ALL v3.0/v3.1 phases — regex only matches numeric-prefixed dirs). Orchestrate v3.2 phases manually with explicit paths; ROADMAP/STATE/REQUIREMENTS completion writes done by hand (gsd-sdk phase.complete fails on vX.Y-NN).

Next: phase v3.2-03 — câblage document complet + stratégie de taille (the LAST v3.2 phase). ✅ CONTEXT GATHERED (discuss-phase done 2026-06-25) → `.planning/phases/v3.2-03-cablage-document-complet-strategie-taille/v3.2-03-CONTEXT.md` (D-01..D-07 + DISCUSSION-LOG). Has a UI hint → **ui-phase pertinent** avant plan. RESUME COMMAND: `/gsd-ui-phase v3.2-03-cablage-document-complet-strategie-taille` (puis `/gsd-plan-phase …`), ou `/gsd-plan-phase …` directement. Décisions clés verrouillées : D-01 nouveau chemin plugin `GetAllParagraphs()` réutilisant l'émetteur md par-élément (ES5 strict, code.js l.2219+/2633/2638) ; **D-02 taille pilotée par CONFIG, défaut ILLIMITÉ (on envoie tout), troncature signalée si budget configuré dépassé** ; D-03 indicateur « tronqué » discret jamais silencieux ; D-04 doc+sélection = les deux indépendamment ; D-05 extraction fraîche à chaque envoi (pas de cache) ; D-06 cadre énuméré (graine D-05 v3.2-02 → frame complet, wording=discrétion) ; D-07 garde-fou contrat v3.1 (PROBE-01+corpus verts, pas de fuite fragments). ⚠️ cap transport bridge 1 Mo (protocol.js l.35) à gérer sur très gros docs. Le seam de composition (v3.2-02) accueille `includeDocument` (ScribeContext l.65-67) sans réécriture.

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
Stopped at (most recent): v3.2-03 discuss-phase DONE — CONTEXT.md + DISCUSSION-LOG.md écrits & committés. 4 axes discutés (troncature, retour tronqué, doc+sélection, fraîcheur) ; décision structurante = taille pilotée par config avec défaut illimité (LLM inconnu/configurable). Next → ui-phase puis plan-phase v3.2-03.
Earlier this session: v3.2-02 EXECUTED + VERIFIED passed (10/10). Discussion+selection gates wired at the sendMessage seam (live-read refs, no stale closure), D-05 framing seed added, deterministic 4-quadrant compose spec + v3.1 corpus/PROBE-01 GREEN (160/160 on the 5 gate specs), v3.1 contract frozen artifacts unmodified. Code review found 0 critical / 2 warning (dev-only probe+panel divergence when selection gated OFF) → both fixed (b1b11bb5f). Next step → v3.2-03 (last v3.2 phase; has UI hint).
Resume file: `.planning/phases/v3.2-02-cablage-discussion-selection/v3.2-02-VERIFICATION.md`.
⚠️ KNOWN PRE-EXISTING RED (NOT a v3.2-02 regression): `ScribeContainer.spec.jsx › configures Drawer PaperProps for fullscreen on mobile` fails (expects height '100%'; impl uses max-85vh auto-height). ScribeContainer last changed in 55768d1f6/d95e9193d — Phase-16 responsive-drawer drift, predates v3.2-02. Worth fixing in a future polish pass.
📋 UAT DÉCIDÉ — DIFFÉRÉE (décision 2026-06-25, B. + Claude) : pas d'UAT live sur v3.2-02. La CORRECTION (composition déterministe, contrat v3.1 intact, zéro fuite dans fragments) est déjà prouvée automatiquement (160/160, corpus + PROBE-01 verts avec contextes activés) → vérification `passed`, aucun item humain. Seule l'EFFICACITÉ LLM (le modèle exploite-t-il réellement l'historique/la sélection ?) nécessiterait un œil humain — mais le prompt est encore en évolution : le framing D-05 n'est qu'une AMORCE que v3.2-03 retravaille (frame multi-source complet) en ajoutant le bloc document. Tester live maintenant = jeté à v3.2-03. ⇒ UAT LLM-efficacité CONSOLIDÉE après v3.2-03, sur l'état quasi-final du prompt v3.2, couvrant les 3 sources ensemble (sélection + discussion + document). Rien ne ship entre-temps (milestone v3.2 ne ferme qu'à v3.2-03).
✅ RESUME after reboot: run `/gsd-plan-phase v3.2-02-cablage-discussion-selection`. The full slug resolves now that the phase dir exists (verified init.plan-phase phase_found=true on 06-25 after CONTEXT.md write). NO dev env (OO/cozy-stack) needed for planning — it's pure doc generation; the env is only needed later for execute/UAT.
ℹ️ TOOLING NUANCE (refines prior note): gsd-sdk resolves phases by EXISTING directory slug. A brand-new phase whose dir doesn't exist yet returns phase_found=false on the full slug (that's why the first init.plan-phase call this session failed — dir not yet created). Once the dir exists, the full slug works end-to-end. Separately, `roadmap.get-phase` matches the ROADMAP.md heading, so IT needs the abbreviated `v3.2-02`. The abbreviated form's auto `expected_phase_dir` mangles accents (`v3.2-02-c-blage-...`) — irrelevant now since the correct dir already exists. See [[milestone-prefixed-numbering-convention]].
v3.2-02 reads the three include booleans from ScribeContext (l.65-67) at the `sendMessage` prompt-assembly seam (l.164, comment `read by v3.2-02/03; no prompt injection in v3.2-01`). The uncommitted `plugins/onlyoffice-scribe/scripts/code.js` is the selection-cases-harness chantier's dev hooks — leave it; NOT part of v3.2.
Env after reboot: OO container + cozy-stack must be up; Drive `src/` changes need `yarn build` then hard-reload (NOT an OO restart). The uncommitted `plugins/onlyoffice-scribe/scripts/code.js` is the selection-cases-harness chantier's dev hooks — leave it; NOT part of v3.2.

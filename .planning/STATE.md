---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Contrat de réponse structurée LLM
status: executing
stopped_at: Phase v3.1-05 context gathered (popover UI); ex-v3.1-05 split into 05/06/07; ready to plan v3.1-05
last_updated: "2026-06-22T01:00:00.000Z"
last_activity: 2026-06-22 -- discuss v3.1-05: split phase into 05/06/07, captured popover UI CONTEXT
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 5
  completed_plans: 5
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** L'utilisateur peut interagir avec l'IA de maniere fluide -- actions rapides inline ou chat conversationnel dans un panneau lateral -- pour transformer et manipuler le contenu de son document OnlyOffice.
**Current focus:** Phase v3.1-04 — COMPLETE (live OO FRAG-03 UAT passed 2026-06-22). Next: v3.1-05 (Rendu popover + durcissement) — last phase of the milestone.

## Current Position

Phase: v3.1-04 (Rendu chat — cartes + clavier) — **COMPLETE** (5/5 plans; live OO FRAG-03 UAT passed 2026-06-22)
Plan: 5 of 5 — committed (18 TDD commits a93963ca9..HEAD) + WR-01 keyboard fix; targeted + Scribe-dir suites green (166 pass; lone failure = pre-existing ScribeContainer mobile-Drawer test)
Status: Verification = verified. FRAG-03 rich reinjection confirmed live in the OO editor (v3.1-04-HUMAN-UAT.md: 1/1 pass). All 9 v3.1-04 requirements Validated.
Progress: [████████  ] 80% (4/5 phases complete)
Last activity: 2026-06-22 -- Phase v3.1-04 live UAT (FRAG-03) PASSED; phase marked complete

⚠️ TOOLING: gsd-sdk v1.42.3 cannot resolve `vX.Y-NN` phases (find-phase/phase-plan-index return "Phase not found" for ALL v3.0/v3.1 phases — regex only matches numeric-prefixed dirs). All phases orchestrated manually with explicit paths; ROADMAP/STATE/REQUIREMENTS completion writes done by hand (gsd-sdk phase.complete fails). v3.1-04 completion writes applied 2026-06-22. Same will apply when finishing v3.1-05.

GATE outcome: v2 contract block (RESPONSE_CONTRACT_BLOCK_V2) PASSES all 4 blockers (dup 0% / preamble
0% / splitTable 0 / refBroken 0) on N=46 incl. real IHM-captured table/REF; deployed v1 is a measured
NO-GO (preamble 21.4%, splitTable 1) on the same data.

✅ FOLLOW-UP DONE (2026-06-19): v2 adopted in prod via UNIFICATION refactor — shared
RESPONSE_CONTRACT_CORE + per-surface cardinality (CARDINALITY_INLINE/_CHAT) + shared
markerPreservationClauses() in scribeAI.js; ScribeContext uses buildChatSystemPrompt(). Both surfaces
now share the gate-validated contract; chat gained marker preservation it never had. Harness extended
to chat (N=52 re-validation, GATE.md §8): dup/preamble/splitTable all 0; refBroken 1/52 = flaky chat
footnote drop (determinism probe 1/6) → accepted as the motivating case for the v3.1-05 re-ask.

Open for v3.1-05: (a) re-ask on refIntegrity breach (closes the flaky REF/footnote tail); (b) ~2%
fellBack (model wraps JSON in a ```json fence). Pre-existing unrelated red test: ScribeContainer
"Drawer PaperProps fullscreen on mobile" (layout, untouched by this work).

Next: plan v3.1-05 (Rendu popover UI — popover result as card + action-menu rework). Context gathered
2026-06-22 (.planning/phases/v3.1-05-rendu-popover-ui/v3.1-05-CONTEXT.md). `/clear` then
`/gsd-plan-phase v3.1-05`. Milestone v3.1 now has 7 phases (05 UI / 06 durcissement / 07 i18n).

## v3.1 Roadmap Summary

Execution order (HARD GATE at v3.1-03): v3.1-01 -> v3.1-02 -> v3.1-03 -> v3.1-04 -> v3.1-05 -> v3.1-06 -> v3.1-07

⚠️ 2026-06-22: ex-phase v3.1-05 « Rendu popover + durcissement » **découpée en 3 phases** (05 UI / 06 durcissement / 07 i18n) en discussion. Le scope UI de 05 a été élargi (refonte du menu d'actions du popover). INLINE-01/02 re-mappées v3.1-02 → v3.1-05 ; I18N-01 → v3.1-07 ; nouveaux req MENU-01 (05), HARDEN-01/02 (06).

| Phase | Goal | Requirements |
|-------|------|--------------|
| v3.1-01 Module contrat | `scribeResponse.js` pur + testé (parse tolérant, validation maison, repli contextuel, schéma) | CONTRACT-01, CONTRACT-03, CONTRACT-04 |
| v3.1-02 Prompt + plumbing | Prompts contractuels + seam de parse sur les deux surfaces, modèle de message étendu, miroir inline → chat | (seam ; INLINE-01/02 validés en v3.1-05) |
| v3.1-03 Sonde dev (HARD GATE) | Panneau dev + métriques de conformité ; gate go/no-go avant tout rendu de cartes | PROBE-01 |
| v3.1-04 Rendu chat (cartes + clavier) | Cartes de fragment, Copier/Insérer/Remplacer, réinjection riche, navigation clavier | CONTRACT-02, FRAG-01..04, KBD-01..04 |
| v3.1-05 Rendu popover (UI) | Fragment unique en carte (réutilise FragmentCard/MarkdownPreview), sans discussion + refonte menu (prompt intégré, entrée « ouvrir panneau ») | INLINE-01, INLINE-02, MENU-01 |
| v3.1-06 Durcissement contrat | Re-ask sur parse invalide, corpus de régression, décision flag `response_format` (sans UI OO) | HARDEN-01, HARDEN-02 |
| v3.1-07 i18n 5 locales | Libellés carte + repli traduits/vérifiés fr/en/de/es/it ; zéro chaîne en dur | I18N-01 |

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

**By Phase (v3.1):**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| v3.1-03 Sonde dev | 01 | ~12min | 2 (TDD) | 2 |
| Phase v3.1-03 P03 | ~14min | 2 tasks | 3 files |

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
- [v3.1-03-01] scribeProbe.js = module pur zéro-dépendance (5 métriques + corpus localStorage versionné) ; Dice word-bigram fait main, pas de string-similarity npm
- [v3.1-03-01] DUP_THRESHOLD=0.6 et MAX_SAMPLES=200 tagués [ASSUMED] — figés contre données réelles dans GATE.md (gate hybride D-01)
- [v3.1-03-01] footnotes [^scribe-fn-N] incluses dans le même set-diff d'identifiants que scribe-ref-N (Open Question 3 résolue)
- [v3.1-03-01] replay LLM-free et idempotent vs record-time ; corpus corrompu/version-stale se réinitialise à vide sans crasher la session dev
- [v3.1-03-03] GATE.md (D-02) = doc source-of-truth go/no-go durable ; tous les seuils numériques tagués [ASSUMED] avec colonne « frozen value » vide à figer par l'utilisateur (gate hybride D-01)
- [v3.1-03-03] probe-corpus.json curaté stocké sous .planning/phases/v3.1-03-.../ (Open Question 1 : la preuve du gate vit avec GATE.md) ; enveloppe versionnée {v:1,samples} alignée sur scribeProbe.importCorpus/replay
- [v3.1-03-03] métrique A/B qualité de prose du critère 2 ROADMAP retirée (D-06) ; métriques survivantes = duplication, préambule par locale, table non scindée, REF préservés, répartition 0/1/N
- [v3.1-03-02] les DEUX surfaces Scribe (popover + chat) alimentent le corpus post-parse via recordProbeSample gardé par isScribeDevMd() (D-11) ; coût production nul
- [v3.1-03-02] DevPanelGrid étendu de façon additive (D-10) : panneau « Réponse parsée » (JSON contrat surligné) + panneau « Métriques + couverture » (aggregate(replay()) : taux/comptes/répartition/couverture + export/import) ; tout le calcul métrique reste dans scribeProbe.js
- [v3.1-03-02] réponse parsée injectée dans le panneau via une prop `parsedResponse` (état popover, dev-gated) plutôt que re-parsée dans le composant

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

Last session: 2026-06-19T14:35:47.728Z
Stopped at: Phase v3.1-04 context gathered
Resume file: .planning/phases/v3.1-04-rendu-chat-cartes-clavier/v3.1-04-CONTEXT.md

# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v3.0 Scribe Chat Panel** -- Phases v3.0-01 to v3.0-04 (shipped 2026-04-04)
- ✅ **v3.1 Contrat de réponse structurée LLM (MCP-ready)** -- Phases v3.1-01 to v3.1-07 (shipped 2026-06-24)
- 🚧 **v3.2 Contexte enrichi du prompt** -- Phases v3.2-01 to v3.2-03 (planning, started 2026-06-24)

## Phases

<details>
<summary>v1.0 Scribe Interface Mock AI (Phases 1-6) -- SHIPPED 2026-03-03</summary>

- [x] Phase 1: Plugin OnlyOffice POC (2/2 plans) -- completed 2026-02-28
- [x] Phase 2: Contextual Trigger and Communication Bridge (2/2 plans) -- completed 2026-02-28
- [x] Phase 3: Scribe Interface with Mock AI (2/2 plans) -- completed 2026-03-01
- [x] Phase 4: End-to-End Actions (covered by Phases 2-3) -- completed 2026-03-01
- [x] Phase 5: Bouton Scribe flottant ancre a la selection (2/2 plans) -- completed 2026-03-03
- [x] Phase 6: Affinement UI/UX (2/2 plans) -- completed 2026-03-03

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Scribe Live AI (Phases 7-9) -- SHIPPED 2026-03-06</summary>

- [x] Phase 7: Real AI Integration (2/2 plans) -- completed 2026-03-04
- [x] Phase 8: Error Handling (1/1 plan) -- completed 2026-03-05
- [x] Phase 9: Internationalization (2/2 plans) -- completed 2026-03-06

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Formatage Riche (Phases 10-13) -- SHIPPED 2026-03-09</summary>

- [x] Phase 10: Extraction Rich Text (2/2 plans) -- completed 2026-03-06
- [x] Phase 11: Pipeline de Conversion (2/2 plans) -- completed 2026-03-06
- [x] Phase 12: Preview Markdown (1/1 plan) -- completed 2026-03-07
- [x] Phase 13: Reinjection et Integrite Pipeline (1/1 plan) -- completed 2026-03-09

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v3.0 Scribe Chat Panel (Phases v3.0-01 to v3.0-04) -- SHIPPED 2026-04-04</summary>

- [x] **Phase v3.0-01: ScribeContext + Panel Shell** - State provider and flex sibling panel that resizes OO iframe
- [x] **Phase v3.0-02: Chat Core** - Working conversational chat with AI, markdown rendering, and error handling
- [x] **Phase v3.0-03: Selection Context + Document Actions** - Selection chip in input, Copy/Replace/Insert on AI responses (completed 2026-03-18)
- [x] **Phase v3.0-04: Panel Resize** - Drag-resizable panel width (completed 2026-03-19)

Full v3.0 phase details are preserved in `.planning/milestones/v3.0-ROADMAP.md`.

</details>

<details>
<summary>v3.1 Contrat de réponse structurée LLM (MCP-ready) (Phases v3.1-01 to v3.1-07) -- SHIPPED 2026-06-24</summary>

- [x] **Phase v3.1-01: Module contrat** (2/2 plans) -- completed 2026-06-16
- [x] **Phase v3.1-02: Prompt + plumbing** (3/3 plans) -- completed 2026-06-17
- [x] **Phase v3.1-03: Sonde dev (HARD GATE)** (3/3 plans) -- completed 2026-06-17
- [x] **Phase v3.1-04: Rendu chat (cartes + clavier)** (5/5 plans) -- completed 2026-06-22
- [x] **Phase v3.1-05: Rendu popover (UI)** (2/2 plans) -- completed 2026-06-22
- [x] **Phase v3.1-06: Durcissement contrat** (2/2 plans) -- completed 2026-06-24
- [x] **Phase v3.1-07: i18n 5 locales** (2/2 plans) -- completed 2026-06-24

Full details: `.planning/milestones/v3.1-ROADMAP.md`

</details>

### v3.2 Contexte enrichi du prompt (Phases v3.2-01 to v3.2-03) -- IN PROGRESS

- [x] **Phase v3.2-01: Zone « Inclure » discrète (UX statique)** - Discreet include zone with 3 checkboxes above the prompt, no LLM wiring
- [x] **Phase v3.2-02: Câblage discussion + sélection** - Inject checked conversation history and current selection into the prompt
- [ ] **Phase v3.2-03: Câblage document complet + stratégie de taille** - Inject the full docx (markdown) with a documented truncation/size strategy and user feedback

## Progress

**Execution Order:**
v3.1 phases execute in order: v3.1-01 -> v3.1-02 -> v3.1-03 (HARD GATE) -> v3.1-04 -> v3.1-05 -> v3.1-06 -> v3.1-07

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plugin OnlyOffice POC | v1.0 | 2/2 | Complete | 2026-02-28 |
| 2. Contextual Trigger and Communication Bridge | v1.0 | 2/2 | Complete | 2026-02-28 |
| 3. Scribe Interface with Mock AI | v1.0 | 2/2 | Complete | 2026-03-01 |
| 4. End-to-End Actions | v1.0 | 0/0 | Complete | 2026-03-01 |
| 5. Bouton Scribe flottant | v1.0 | 2/2 | Complete | 2026-03-03 |
| 6. Affinement UI/UX | v1.0 | 2/2 | Complete | 2026-03-03 |
| 7. Real AI Integration | v2.0 | 2/2 | Complete | 2026-03-04 |
| 8. Error Handling | v2.0 | 1/1 | Complete | 2026-03-05 |
| 9. Internationalization | v2.0 | 2/2 | Complete | 2026-03-06 |
| 10. Extraction Rich Text | v2.1 | 2/2 | Complete | 2026-03-06 |
| 11. Pipeline de Conversion | v2.1 | 2/2 | Complete | 2026-03-06 |
| 12. Preview Markdown | v2.1 | 1/1 | Complete | 2026-03-07 |
| 13. Reinjection et Integrite Pipeline | v2.1 | 1/1 | Complete | 2026-03-09 |
| v3.0-01. ScribeContext + Panel Shell | v3.0 | 2/2 | Complete | 2026-03-15 |
| v3.0-02. Chat Core | v3.0 | 2/2 | Complete | 2026-03-18 |
| v3.0-03. Selection Context + Document Actions | v3.0 | 2/2 | Complete | 2026-03-18 |
| v3.0-04. Panel Resize | v3.0 | 1/1 | Complete | 2026-03-19 |
| v3.1-01. Module contrat | v3.1 | 2/2 | Complete | 2026-06-16 |
| v3.1-02. Prompt + plumbing | v3.1 | 3/3 | Complete | 2026-06-17 |
| v3.1-03. Sonde dev (HARD GATE) | v3.1 | 3/3 | Complete | 2026-06-17 |
| v3.1-04. Rendu chat (cartes + clavier) | v3.1 | 5/5 | Complete | 2026-06-22 |
| v3.1-05. Rendu popover (UI) | v3.1 | 2/2 | Complete | 2026-06-22 |
| v3.1-06. Durcissement contrat | v3.1 | 2/2 | Complete | 2026-06-24 |
| v3.1-07. i18n 5 locales | v3.1 | 2/2 | Complete | 2026-06-24 |
| v3.2-01. Zone « Inclure » discrète (UX statique) | v3.2 | 1/1 | Complete | 2026-06-24 |
| v3.2-02. Câblage discussion + sélection | v3.2 | 1/1 | Complete | 2026-06-25 |
| v3.2-03. Câblage document complet + stratégie de taille | v3.2 | 0/4 | Planned | - |

## Phase Details

_Active milestone only. Shipped milestones keep their full phase details in `.planning/milestones/vX.Y-ROADMAP.md`._

### v3.2 Contexte enrichi du prompt

**Goal:** Permettre à l'utilisateur d'enrichir le prompt LLM avec, au choix, le document docx complet, l'historique de discussion, ou la sélection courante — d'abord via une UX discrète dans le side panel, puis par l'injection réelle des contextes cochés dans le prompt. UX d'abord (statique), puis câblage LLM de bout en bout.

**Execution order:** v3.2-01 (UX statique) -> v3.2-02 (câblage discussion + sélection) -> v3.2-03 (câblage document complet + taille).

#### Phase v3.2-01: Zone « Inclure » discrète (UX statique)

**Goal**: Une zone « Inclure » discrète apparaît au-dessus du prompt du side panel avec trois cases à cocher (« document », « discussion », « sélection »), avec leurs états par défaut et l'apparition conditionnelle de la sélection — purement UI, aucun contexte n'est encore injecté dans l'appel LLM
**Depends on**: Nothing (first phase of v3.2; builds on shipped v3.1 codebase — ChatInput.jsx, SelectionChip.jsx, ScribeContext)
**Requirements**: CTX-UX-01, CTX-UX-02, CTX-UX-03, CTX-UX-04, CTX-UX-05
**Success Criteria** (what must be TRUE):
  1. Une zone « Inclure » est rendue dans le side panel, juste au-dessus de la zone de prompt (ChatInput), contenant trois cases à cocher étiquetées « document », « discussion », « sélection » (libellés i18n sur les 5 locales fr/en/de/es/it, zéro chaîne en dur)
  2. À l'ouverture, « document » et « discussion » sont décochées ; la case « sélection » n'est présente que lorsqu'une sélection active existe (`currentSelection` non nul) et est cochée par défaut dès qu'une sélection apparaît
  3. Cocher « sélection » révèle la zone d'affichage de la sélection courante en réutilisant le chip/zone existant (SelectionChip) ; la décocher masque ce chip — sans perdre la sélection sous-jacente
  4. Les cases sont visuellement discrètes (taille réduite, intégration légère, cohérence thème clair/sombre via useTheme) et n'alourdissent pas le panel — validé en revue UX
  5. L'état coché/décoché de chaque case vit dans un état partagé (ScribeContext ou local au panel) prêt à être lu par le câblage des phases 02-03, mais aucune valeur de contexte n'est encore ajoutée au prompt LLM (comportement d'appel inchangé vs v3.1)
**Plans**:
- [x] v3.2-01-01-PLAN.md — Scribe.include.* keys (5 locales) + 3 include booleans in ScribeContext + discreet ScribeIncludeZone component wired into ChatInput + conditional/default-checked « sélection » chip coupling + behavior/i18n-parity/literal-audit/scope-guard gates [CTX-UX-01..05] (wave 1)
**UI hint**: yes
**UI-SPEC**: v3.2-01-UI-SPEC.md (ui-checker APPROVED)

#### Phase v3.2-02: Câblage discussion + sélection

**Goal**: Quand l'utilisateur coche « discussion » et/ou « sélection », ces contextes sont réellement injectés dans le prompt envoyé au LLM, de façon déterministe, sans altérer le contrat de réponse structurée v3.1 (séparation discussion/fragments) ni le repli/re-ask
**Depends on**: Phase v3.2-01
**Requirements**: CTX-LLM-02, CTX-LLM-03, CTX-LLM-05
**Success Criteria** (what must be TRUE):
  1. Quand « sélection » est cochée, la sélection courante est incluse dans le prompt de façon explicite et formalisée (réutilise `encodeSelectionForPrompt` / le bloc `[Selected text from document]…[End of selected text]` existant) ; décochée, la sélection n'est pas envoyée
  2. Quand « discussion » est cochée, l'historique de conversation pertinent est inclus dans le prompt (sérialisation existante `serializeAssistantTurnForHistory`, discussion-seulement) ; décochée, l'appel n'envoie pas l'historique au-delà du tour courant
  3. La composition des contextes inclus est déterministe : ordre et formatage stables et reproductibles pour un même état de cases, assemblés en un seul point de composition (scribeAI / ScribeContext.sendMessage)
  4. Le contrat de réponse v3.1 reste intact : les contextes injectés ne fuient jamais dans `fragments`, la séparation discussion/fragments est préservée, et le re-ask correctif unique + repli contextuel continuent de fonctionner (corpus v3.1 toujours au vert)
  5. La sonde dev (PROBE-01) et les gates de régression existants restent verts avec les contextes activés
**Plans**: 1 plan
- [x] v3.2-02-01-wire-discussion-selection-PLAN.md — gate selection (current turn) + discussion (history) at the ScribeContext.sendMessage seam, read checkboxes live (no stale closure), D-05 conditional framing seed in buildChatSystemPrompt, then a PROBE-01 + v3.1-regression + determinism + no-fragment-leak verification gate [CTX-LLM-02, CTX-LLM-03, CTX-LLM-05] (wave 1)
**UI hint**: no

#### Phase v3.2-03: Câblage document complet + stratégie de taille

**Goal**: Quand l'utilisateur coche « document », le contenu du docx complet (extrait en markdown) est injecté dans le prompt, avec une stratégie de taille/troncature documentée pour le document potentiellement volumineux et un retour utilisateur explicite si le contexte est tronqué
**Depends on**: Phase v3.2-02
**Requirements**: CTX-LLM-01, CTX-LLM-04
**Success Criteria** (what must be TRUE):
  1. Quand « document » est cochée, le contenu du docx complet est extrait en markdown via un chemin d'extraction document-entier (nouveau côté plugin OO, réutilisant l'émetteur markdown par-élément existant — `GetAllParagraphs` + tables/footnotes — au-delà de la seule sélection) et injecté dans le prompt
  2. Une stratégie de limite/troncature de la taille de contexte est décidée et **documentée** (seuil, point de coupe, priorité), spécifiquement pour le docx complet
  3. Lorsque le contexte document est tronqué, l'utilisateur en reçoit un retour explicite (indication UI/i18n) — il n'est jamais silencieusement coupé
  4. L'injection du document complet respecte le contrat de réponse v3.1 (séparation discussion/fragments intacte, pas de fuite dans `fragments`) et passe par le même point de composition déterministe que la phase v3.2-02
  5. Les trois sources de contexte (document, discussion, sélection) peuvent être cochées dans n'importe quelle combinaison sans casser la composition ni le contrat
**Plans**: 4 plans (3 waves)
- [x] v3.2-03-01-plugin-fulldoc-extractor-PLAN.md — new on-demand full-document markdown extractor in code.js (document-order walk reusing the leaf emitters, never silent) + dedicated bridge channel [CTX-LLM-01] (wave 1)
- [x] v3.2-03-02-host-compose-budget-framing-PLAN.md — extractFullDocument round-trip (View.jsx) + includeDocumentRef/budget/ephemeral doc block/documentNotice at the sendMessage seam + grow contextSourceFraming [CTX-LLM-01, CTX-LLM-04] (wave 1)
- [x] v3.2-03-03-truncation-feedback-i18n-PLAN.md — never-silent truncation/failure notice in ChatMessageList (UI-SPEC reuse) + 5-locale i18n keys [CTX-LLM-04] (wave 2)
- [ ] v3.2-03-04-regression-composition-gate-PLAN.md — extend compose + scribeAI specs (document path, any-combination, determinism) and run the PROBE-01 + corpus + literal-audit GREEN gate (D-07) [CTX-LLM-01, CTX-LLM-04] (wave 3)
**UI hint**: yes

## Backlog

### Phase 999.1: Centralisation des prompts IA (Scribe → module partagé) (BACKLOG)

**Goal:** [Captured for future planning]
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

**Contexte / constat**

Cozy a deux familles de prompts IA à des endroits différents :
- **Panel IA officiel** (résumé de doc, `cozy-viewer`) → prompts dans un module dédié `cozy-viewer/src/Panel/AI/prompts.js` (`SUMMARY_SYSTEM_PROMPT`, `LONG_`, `SHORT_`, `getSummaryUserPrompt()`), appelé via le helper `chatCompletion(client, messages, {stream, model})` de cozy-client.
- **Scribe** (branche `feat/scribe-in-right-panel`) → prompts **en dur** dans le code : `scribeAI.js` (`SYSTEM_PROMPT`, `RESPONSE_CONTRACT_CORE`, persona chat `buildChatSystemPrompt`, garde-fous free-prompt, `encodeSelectionForPrompt`) + `scribeActions.js` (~14 templates `{selectedText}`), appelé via `fetchJSON` direct sur `/ai/v1/chat/completions` (choisi pour le support `AbortController`).

Les deux finissent sur le **même endpoint stack**. Critique d'un collègue : *« ça passe pas par ai prompts »* = Scribe ne réutilise pas le module ai-prompts partagé.

**Inventaire des prompts Scribe à migrer**
- `scribeAI.js` : `SYSTEM_PROMPT`, `RESPONSE_CONTRACT_CORE` (contrat JSON `discussion`/`fragments`), persona chat, template garde-fou free-prompt, `encodeSelectionForPrompt`.
- `scribeActions.js` : ~14 templates — correction grammaire, traduction (×6 langues + custom), ton (pro/casual/poli), reformulation (raccourcir/développer/emojify/bullets).

**Objectif**

Extraire les prompts hors de Scribe vers un module de prompts partagé (pendant de `Panel/AI/prompts.js`) → source unique de vérité, versionnable/réutilisable, modifiable sans toucher la logique Scribe.

**Décisions à trancher au démarrage**
1. **Où héberger le module** : `cozy-viewer` (vraiment partagé mais lib externe à publier) vs Drive interne (simple mais non partagé).
2. Le module actuel ne couvre que le **résumé** → l'étendre à des prompts **paramétrés** (ton, langue, format de réponse).
3. **Aligner aussi le chemin d'appel ?** Scribe utilise `fetchJSON` direct exprès (`AbortController`, cf. commentaire `callScribeAI`) ; `chatCompletion` ne le permet pas → soit centraliser **juste les prompts**, soit faire évoluer `chatCompletion` pour accepter un `signal`.
4. Le **contrat JSON `discussion`/`fragments`** (+ `response_format: json_object` de la PR #2) est spécifique Scribe → à garder comme template à part.

**Coût indicatif**
- **Petit** si centralisation interne Drive (refactor mécanique, faible risque).
- **Moyen/gros** si vrai partage via `cozy-viewer` + alignement du chemin d'appel (`chatCompletion` + `AbortController`) → touche une lib externe, coordination/publication.

**Important** : ni bug ni faille de sécurité — architecture/cohérence. Aucune urgence, indépendant de la PR #2 (JSON) et du fix JWT.

# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v3.0 Scribe Chat Panel** -- Phases v3.0-01 to v3.0-04 (shipped 2026-04-04)
- ✅ **v3.1 Contrat de réponse structurée LLM (MCP-ready)** -- Phases v3.1-01 to v3.1-07 (shipped 2026-06-24)

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

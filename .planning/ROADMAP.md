# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v3.0 Scribe Chat Panel** -- Phases v3.0-01 to v3.0-04 (shipped 2026-04-04)
- 🚧 **v3.1 Contrat de réponse structurée LLM (MCP-ready)** -- Phases v3.1-01 to v3.1-05 (in progress)

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

### v3.1 Contrat de réponse structurée LLM (MCP-ready) (In progress)

**Milestone Goal:** Séparer sans ambiguïté la méta-discussion (`discussion`) du contenu insérable (`fragments`) dans les réponses du LLM, via un contrat JSON (formalisme JSON Schema, MCP-ready, sans serveur), exploité dans le chat et le popover. Construit sur la branche feat puis mergé en fin de milestone (états intermédiaires confinés à la branche, jamais exposés en prod).

- [x] **Phase v3.1-01: Module contrat** (2/2 plans) -- completed 2026-06-16 - `scribeResponse.js` pur (parse tolérant + validation maison + repli contextuel + schéma), entièrement testé, zéro UI
- [x] **Phase v3.1-02: Prompt + plumbing** (3/3 plans) -- completed 2026-06-17 - Prompts contractuels sur les deux surfaces, seam de parse aux deux call sites, modèle de message étendu, sérialisation multi-tour, miroir inline → historique chat
- [x] **Phase v3.1-03: Sonde dev (HARD GATE)** (3/3 plans) -- completed 2026-06-17 - Panneau dev exposant la réponse parsée + métriques de conformité ; ses critères de passage conditionnent les phases 04-05
- [x] **Phase v3.1-04: Rendu chat (cartes + clavier)** (5/5 plans) -- completed 2026-06-22 - Cartes de fragment encadrées aux positions `{{fragment:N}}`, boutons Copier/Insérer/Remplacer, réinjection riche par fragment, navigation clavier complète
- [x] **Phase v3.1-05: Rendu popover (UI)** - Popover rend le fragment unique en carte (réutilise FragmentCard/MarkdownPreview de v3.1-04, marqueurs propres), sans afficher la `discussion` ; refonte du menu d'actions (prompt libre intégré comme entrée, entrée « Ouvrir le panneau latéral » remplaçant l'icône)
- [ ] **Phase v3.1-06: Durcissement contrat** - Re-ask sur parse invalide (1× avant repli), corpus de régression des réponses malformées, décision documentée du défaut `response_format` (sans UI OO)
- [ ] **Phase v3.1-07: i18n 5 locales** - Libellés de carte + messages de repli traduits et vérifiés sur fr/en/de/es/it ; aucune chaîne Scribe en dur dans les surfaces popover/chat

## Phase Details

### Phase v3.1-01: Module contrat
**Goal**: Une bibliothèque pure et testée transforme n'importe quelle réponse LLM brute en `{discussion, fragments, valid, fellBack, warnings}` de façon fiable, sans toucher à l'UI ni au comportement existant
**Depends on**: Nothing (first phase of v3.1; builds on shipped v3.0 codebase)
**Requirements**: CONTRACT-01, CONTRACT-03, CONTRACT-04
**Success Criteria** (what must be TRUE):
  1. `parseScribeResponse(raw, {surface})` extrait `discussion` et `fragments[]` d'une réponse valide (fences strippées → premier `{…}` équilibré string-aware → réparation virgule traînante → `JSON.parse` → validation maison) et le démontrent les tests unitaires
  2. Sur une réponse non conforme, `parseScribeResponse` ne lève jamais : il applique le repli selon `surface` (chat → discussion + filet ; inline → brut = unique fragment) et positionne `fellBack: true`
  3. La regex `{{fragment:\d+}}` repère les marqueurs de position sans jamais altérer les marqueurs cross-ref `{{REF:scribe-ref-N:…}}` (test de préservation dédié au vert)
  4. `serializeAssistantTurnForHistory` et `extractChannelMarkers(text, channel)` (MCP-ready) produisent les sorties attendues, et `SCRIBE_OUTPUT_SCHEMA` est commité comme artefact documenté
  5. Le module est pur (aucun import React/réseau) et n'a aucun effet de bord tant qu'il n'est pas câblé en v3.1-02
**Plans**: 2 plans
- [x] v3.1-01-01-PLAN.md — parseScribeResponse tolerant parse + home-grown validation + context-aware fallback + security hardening
- [x] v3.1-01-02-PLAN.md — {{fragment:N}} marker grammar (REF-safe), extractChannelMarkers, serializeAssistantTurnForHistory, SCRIBE_OUTPUT_SCHEMA

### Phase v3.1-02: Prompt + plumbing
**Goal**: Les deux surfaces (chat + inline) émettent le contrat et le parsent à la réception, sans nouveau rendu : la `discussion` sert de contenu affiché, le comportement reste fonctionnellement équivalent à aujourd'hui, prouvant l'absence de régression
**Depends on**: Phase v3.1-01
**Requirements**: INLINE-01, INLINE-02
**Success Criteria** (what must be TRUE):
  1. Les system prompts émettent le contrat : chat = 0..N fragments (discussion libre autorisée), inline = exactement 1 fragment (discussion autorisée mais non rendue)
  2. Les deux call sites (ScribePopover + ScribeContext.sendMessage) passent la réponse par le seam de parse de v3.1-01 avant tout affichage
  3. Le modèle de message est étendu (`{discussion, fragments, fellBack}`) tout en conservant `content == discussion`, et l'UI existante continue de fonctionner inchangée
  4. La sérialisation multi-tour n'envoie au LLM que la `discussion` (+ note compacte sur les fragments), sans réinjecter le contenu brut des fragments
  5. Chaque échange inline (prompt + discussion + fragment) est répercuté dans l'historique de conversation partagé et apparaît dans le chat à l'ouverture du side panel
**Plans**: 3 plans
- [x] v3.1-02-01-PLAN.md — inline contract prompt (shared contract block + "exactly ONE" cardinality + reworded conditional marker rules) in scribeAI.js
- [x] v3.1-02-02-PLAN.md — chat contract prompt + parse seam (surface:'chat') + extended message model + history serialization + throwaway render-time compose helper
- [x] v3.1-02-03-PLAN.md — inline parse seam (surface:'popover') + single-fragment normalization + normalized-fragment display/insert + full-turn mirroring into chat history

### Phase v3.1-03: Sonde dev (HARD GATE before render)
**Goal**: Confirmer empiriquement que le modèle réel produit une séparation discussion/fragments de qualité suffisante (1 / N / 0) AVANT de construire la moindre carte — ce phase est un go/no-go gate pour les phases 04-05
**Depends on**: Phase v3.1-02
**Requirements**: PROBE-01
**Success Criteria** (what must be TRUE):
  1. Un panneau dev expose, pour chaque réponse, `{discussion, fragments, valid, fellBack, warnings}` lisible en direct
  2. La sonde calcule des métriques de conformité : duplication discussion↔fragment, détection de préambule par locale (fr/en/de/es/it), table non scindée, REF préservés, répartition 0/1/N
  3. Les critères de passage de la sonde sont explicitement documentés et leur résultat (pass/no-go) est enregistré comme gate des phases v3.1-04 et v3.1-05
  4. La sonde est un outil de dev (panneau/console) qui n'affecte pas l'utilisateur final
**Plans**: 3 plans
- [x] v3.1-03-01-PLAN.md — pure scribeProbe.js metrics (duplication/preamble/split-table/REF) + localStorage corpus (export/import/replay/aggregate) + Jest spec
- [x] v3.1-03-02-PLAN.md — capture both surfaces (popover+chat) dev-gated + DevPanelGrid parsed-response & metrics/coverage panels; human-verify approved (7/7) + refinements: side-panel probe button + clearer metric labels (a96206f4d)
- [x] v3.1-03-03-PLAN.md — GATE.md scaffold ([ASSUMED] thresholds) + curated probe-corpus.json + ROADMAP criterion-2 A/B retirement
**UI hint**: yes

### Phase v3.1-04: Rendu chat (cartes + clavier)
**Goal**: Dans le panneau chat, l'utilisateur voit la discussion et chaque fragment dans une carte distincte avec actions, et peut tout piloter au clavier comme à la souris
**Depends on**: Phase v3.1-03 (gate sonde passé)
**Requirements**: CONTRACT-02, FRAG-01, FRAG-02, FRAG-03, FRAG-04, KBD-01, KBD-02, KBD-03, KBD-04
**Success Criteria** (what must be TRUE):
  1. Chaque fragment s'affiche dans une carte encadrée, visuellement distincte de la discussion, à la position de son marqueur `{{fragment:N}}` (fragments non référencés rendus en fin de message) ; une réponse de pure discussion (0 fragment) n'affiche aucune carte ni UI d'insertion
  2. Chaque carte porte Copier / Insérer / Remplacer, Remplacer n'apparaissant que lorsqu'une sélection est active dans le document
  3. Insérer/Remplacer un fragment conserve le formatage riche (tables, images, footnotes, cross-refs) via le pipeline de réinjection existant, appliqué par fragment
  4. Au clavier : ↑ depuis l'input va sur Insérer de la carte la plus récente ; ←/→ cyclent Copier/Insérer/Remplacer ; ↑/↓ parcourent les fragments à travers le fil puis reviennent à l'input ; Échap revient à l'input ; Entrée/Espace activent le bouton focalisé
**Plans**: 5 plans
- [x] v3.1-04-01-PLAN.md — pure buildAssistantSegments helper (segment placement: cards at {{fragment:N}}, orphans at end, REF-safe) + spec [CONTRACT-02, FRAG-01]
- [x] v3.1-04-02-PLAN.md — extend MarkdownPreview cosmetic preprocessor (REF→text, TABLE→table, footnote→sup, idempotent) + spec; rehype-raw XSS surfaced for v3.1-05 [D-02]
- [x] v3.1-04-03-PLAN.md — FragmentCard (bordered Scribe-purple card, MarkdownPreview(raw) + 3 raw-driven gated actions) + MessageActions focus ring + spec [FRAG-02, FRAG-03, FRAG-04]
- [x] v3.1-04-04-PLAN.md — ChatMessageList segment render (prose+cards), delete composeAssistantDisplay, remove message-level actions (D-08) + spec [CONTRACT-02, FRAG-01, FRAG-03]
- [x] v3.1-04-05-PLAN.md — thread-level keyboard controller + ChatInput hooks + ScribePanel wiring (manual-index, no new dep) + spec [KBD-01, KBD-02, KBD-03, KBD-04]
**UI hint**: yes

### Phase v3.1-05: Rendu popover (UI)
**Goal**: Le popover inline rend le fragment unique pour Insérer/Remplacer en réutilisant le rendu carte de v3.1-04 (MarkdownPreview + marqueurs propres), sans afficher la `discussion` ; le menu d'actions est refondu (prompt libre intégré comme entrée de liste, accès au panneau latéral déplacé dans le menu)
**Depends on**: Phase v3.1-04
**Requirements**: INLINE-01, INLINE-02, MENU-01
**Success Criteria** (what must be TRUE):
  1. Le popover rend le fragment unique pour Insérer/Remplacer en carte (markdown riche + marqueurs REF/TABLE/footnote rendus proprement), sans afficher la `discussion`
  2. L'échange inline (prompt + discussion + fragment) est miroité dans l'historique chat (INLINE-02 ; câblage v3.1-02 à valider de bout en bout)
  3. Le prompt libre est une entrée intégrée en bas de la liste du menu ; une entrée « Ouvrir le panneau latéral » la suit, remplaçant l'icône open-panel retirée du popover (le bouton flottant sur le document est conservé)
**Plans**: 2 plans
Plans:
- [x] v3.1-05-01-PLAN.md — Popover result rendered as a Scribe-violet card (RAW fragment via MarkdownPreview, no discussion); validate inline→chat mirror (INLINE-01/02) — implemented 2026-06-22, jest 6/6; live UAT pending
- [x] v3.1-05-02-PLAN.md — Action-menu rework: free-prompt as integrated list entry + bottom "Ouvrir le panneau latéral" entry replacing the in-popover icon (MENU-01) — implemented 2026-06-22, jest 9/9; live UAT pending
**UI hint**: yes

### Phase v3.1-06: Durcissement contrat
**Goal**: Le contrat est durci pour un déploiement fiable : re-ask sur parse invalide, corpus de régression des réponses malformées, et décision documentée du défaut du flag `response_format` — purement logique, sans UI OO
**Depends on**: Phase v3.1-03 (gate sonde passé), Phase v3.1-04
**Requirements**: HARDEN-01, HARDEN-02
**Success Criteria** (what must be TRUE):
  1. Sur une réponse au parse invalide, le système re-sollicite le LLM une seule fois avant d'appliquer le repli contextuel
  2. Un corpus de régression de réponses malformées + tests de cas limites passe au vert ; le taux de `fellBack` code-fence est re-mesuré (stripFence existant confirmé ou complété)
  3. Le défaut du flag `response_format` (prompt-based vs structured-output json_schema) est décidé et documenté, contrainte proxy cozy-stack prise en compte
**Plans**: TBD
**UI hint**: no

### Phase v3.1-07: i18n 5 locales
**Goal**: Les libellés de carte et les messages de repli sont traduits et vérifiés sur les 5 locales cibles (fr, en, de, es, it), sans aucune chaîne Scribe en dur
**Depends on**: Phase v3.1-05, Phase v3.1-04
**Requirements**: I18N-01
**Success Criteria** (what must be TRUE):
  1. Les libellés des cartes et les messages de repli sont traduits dans les 5 locales (fr, en, de, es, it)
  2. Aucune chaîne Scribe en dur ne subsiste dans les surfaces popover et chat (audit des littéraux)
**Plans**: TBD
**UI hint**: yes

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
| v3.1-06. Durcissement contrat | v3.1 | 0/0 | Not started | - |
| v3.1-07. i18n 5 locales | v3.1 | 0/0 | Not started | - |

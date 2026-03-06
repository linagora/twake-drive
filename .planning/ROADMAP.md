# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- 🚧 **v2.1 Formatage Riche** -- Phases 10-13 (in progress)

## Phases

<details>
<summary>✅ v1.0 Scribe Interface Mock AI (Phases 1-6) -- SHIPPED 2026-03-03</summary>

- [x] Phase 1: Plugin OnlyOffice POC (2/2 plans) -- completed 2026-02-28
- [x] Phase 2: Contextual Trigger and Communication Bridge (2/2 plans) -- completed 2026-02-28
- [x] Phase 3: Scribe Interface with Mock AI (2/2 plans) -- completed 2026-03-01
- [x] Phase 4: End-to-End Actions (covered by Phases 2-3) -- completed 2026-03-01
- [x] Phase 5: Bouton Scribe flottant ancre a la selection (2/2 plans) -- completed 2026-03-03
- [x] Phase 6: Affinement UI/UX (2/2 plans) -- completed 2026-03-03

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Scribe Live AI (Phases 7-9) -- SHIPPED 2026-03-06</summary>

- [x] Phase 7: Real AI Integration (2/2 plans) -- completed 2026-03-04
- [x] Phase 8: Error Handling (1/1 plan) -- completed 2026-03-05
- [x] Phase 9: Internationalization (2/2 plans) -- completed 2026-03-06

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### 🚧 v2.1 Formatage Riche (In Progress)

**Milestone Goal:** Preserver et restituer le formatage riche du texte a travers le cycle Scribe (extraction, Markdown, LLM, reconversion, reinjection).

- [x] **Phase 10: Extraction Rich Text** - Extraire le HTML formate depuis OO et le transporter via le protocole postMessage (completed 2026-03-06)
- [x] **Phase 11: Pipeline de Conversion** - Convertir HTML en Markdown (vers LLM) et Markdown en HTML (vers OO) avec nettoyage (completed 2026-03-06)
- [ ] **Phase 12: Preview Markdown** - Afficher le resultat AI en Markdown rendu dans le panneau de resultat
- [ ] **Phase 13: Reinjection et Integrite Pipeline** - Reinjecter le texte formate dans OO et valider le round-trip complet

## Phase Details

### Phase 10: Extraction Rich Text
**Goal**: Le plugin OO extrait le contenu formate de la selection et le transmet au host Cozy Drive
**Depends on**: Phase 9 (v2.0 complete)
**Requirements**: EXTR-01, EXTR-02, EXTR-03
**Success Criteria** (what must be TRUE):
  1. Quand l'utilisateur selectionne du texte gras/italique et declenche Scribe, le HTML formate est extrait (pas seulement le texte brut)
  2. Le HTML extrait arrive dans le composant Scribe de Cozy Drive via le protocole postMessage avec le champ format:"html"
  3. Si l'extraction HTML echoue (API indisponible, plugin incompatible), Scribe fonctionne normalement avec le texte brut comme avant
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md -- HTML extraction from OO with initDataType:"html", class stripping, and plain text fallback
- [ ] 10-02-PLAN.md -- Protocol extension: add html/format fields to AI_TEXT_EDIT intents and pass through to React

### Phase 11: Pipeline de Conversion
**Goal**: La conversion bidirectionnelle HTML/Markdown fonctionne pour tous les elements supportes
**Depends on**: Phase 10
**Requirements**: CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):
  1. Le HTML OO (avec inline styles) est converti en Markdown propre que le LLM recoit dans son prompt
  2. Le Markdown retourne par le LLM est converti en HTML valide pret pour reinjection dans OO
  3. Les elements non supportes (images, SVG, math) sont nettoyes silencieusement au lieu de produire du Markdown casse
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md -- TDD conversion module: scribeConversion.js with htmlToMarkdown (Turndown + OO normalizer) and markdownToHtml (marked)
- [ ] 11-02-PLAN.md -- Integration: wire converters into scribeAI.js buildMessages and ScribePopover selectedHtml prop

### Phase 12: Preview Markdown
**Goal**: L'utilisateur voit le resultat AI avec le formatage rendu dans le panneau de resultat
**Depends on**: Phase 11
**Requirements**: PREV-01, PREV-02
**Success Criteria** (what must be TRUE):
  1. Le panneau de resultat affiche le Markdown rendu (titres, gras, listes, tableaux) au lieu du texte brut
  2. Le rendu Markdown respecte le theme Scribe (couleurs, typographie MUI) en mode clair et sombre
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

### Phase 13: Reinjection et Integrite Pipeline
**Goal**: Le texte formate par l'IA est reinjecte dans OO avec son formatage preserve, completant le cycle de bout en bout
**Depends on**: Phase 12
**Requirements**: REINJ-01, REINJ-02, PIPE-01, PIPE-02, PIPE-03, PIPE-04
**Success Criteria** (what must be TRUE):
  1. L'action "Replace" reinjecte du HTML formate dans OO via PasteHtml -- le texte resultant conserve gras, italique, titres et listes
  2. L'action "Insert After" insere du contenu HTML formate apres la selection sans ecraser le texte existant
  3. Le formatage inline (gras, italique) survit au cycle complet: selection dans OO, envoi au LLM, retour, reinjection dans OO
  4. Les blocs structurels (titres, listes a puces, listes numerotees, paragraphes) survivent au cycle complet
  5. Les tableaux, liens et blocs de code survivent au cycle complet
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 10, 11, 12, 13

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
| 10. Extraction Rich Text | 2/2 | Complete    | 2026-03-06 | - |
| 11. Pipeline de Conversion | 2/2 | Complete   | 2026-03-06 | - |
| 12. Preview Markdown | v2.1 | 0/? | Not started | - |
| 13. Reinjection et Integrite Pipeline | v2.1 | 0/? | Not started | - |

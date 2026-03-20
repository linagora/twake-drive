# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v2.2 Ameliorations UX** -- Phases 14-15 (shipped 2026-03-11)
- ✅ **v2.3 Menu Responsive** -- Phases 16-17 (shipped 2026-03-15)
- ✅ **v2.4 Document Builder Injection** -- Phases 18-20 (shipped 2026-03-20)
- **v2.5 Objets Complexes et Blocs Etendus** -- Phases 21-24 (in progress)

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

<details>
<summary>✅ v2.1 Formatage Riche (Phases 10-13) -- SHIPPED 2026-03-09</summary>

- [x] Phase 10: Extraction Rich Text (2/2 plans) -- completed 2026-03-06
- [x] Phase 11: Pipeline de Conversion (2/2 plans) -- completed 2026-03-06
- [x] Phase 12: Preview Markdown (1/1 plan) -- completed 2026-03-07
- [x] Phase 13: Reinjection et Integrite Pipeline (1/1 plan) -- completed 2026-03-09

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>✅ v2.2 Ameliorations UX (Phases 14-15) -- SHIPPED 2026-03-11</summary>

- [x] Phase 14: Navigation, clavier et micro-interactions (2/2 plans) -- completed 2026-03-10
- [x] Phase 15: Panneau de resultat interactif (1/1 plan) -- completed 2026-03-11

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3 Menu Responsive (Phases 16-17) -- SHIPPED 2026-03-15</summary>

- [x] Phase 16: Drawer Scaffold + Breakpoint Split (1/1 plan) -- completed 2026-03-12
- [x] Phase 17: Push Navigation + Adaptive Layout (2/2 plans) -- completed 2026-03-15

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>✅ v2.4 Document Builder Injection (Phases 18-20) -- SHIPPED 2026-03-20</summary>

- [x] Phase 18: Token Pipeline + Minimal Builder Injection (2/2 plans) -- completed 2026-03-17
- [x] Phase 19: Extended Markdown Support (2/2 plans) -- completed 2026-03-18
- [x] Phase 20: Injection Polish (2/2 plans) -- completed 2026-03-20

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

### v2.5 Objets Complexes et Blocs Etendus (In Progress)

**Milestone Goal:** Preserver les objets complexes du document (images, tableaux) lors du round-trip LLM via un systeme de marqueurs, et completer le support des blocs markdown (code blocks, blockquotes, tableaux markdown).

- [x] **Phase 21: Blocs Etendus** - Code blocks, blockquotes et tableaux markdown dans le pipeline Builder API existant (completed 2026-03-20)
- [x] **Phase 22: Extraction Pipeline et Contrat Marqueurs** - Pre-scan OO produit du markdown enrichi avec marqueurs; Scribe definit la syntaxe des marqueurs (completed 2026-03-20)
- [x] **Phase 23: Image Round-Trip** - Marqueurs image traversent le LLM; images originales reinjectees via Copy/AddDrawing (completed 2026-03-20)
- [ ] **Phase 24: Table Round-Trip** - Cellules extraites individuellement, traduites par le LLM, reinjectees in-place dans le tableau OO

## Phase Details

### Phase 21: Blocs Etendus
**Goal**: Les resultats IA contenant des code blocks, blockquotes ou tableaux markdown sont injectes comme elements OO natifs via Builder API
**Depends on**: Phase 20 (pipeline Builder API existant)
**Requirements**: BLK-01, BLK-02, BLK-03
**Success Criteria** (what must be TRUE):
  1. Un code block fenced dans le resultat IA apparait dans OO comme un ou plusieurs paragraphes en police monospace, visuellement distincts du texte normal
  2. Un blockquote dans le resultat IA apparait dans OO comme un paragraphe indente, visuellement distinct du texte normal
  3. Un tableau markdown classique (non marque) dans le resultat IA apparait dans OO comme un ApiTable natif avec lignes, colonnes et contenu cellule correct
  4. Les blocs etendus coexistent avec les elements existants (paragraphes, headings, listes, inline formatting) sans regression
**Plans**: 2 plans

Plans:
- [ ] 21-01: Code blocks + blockquotes dans flattenTokens/buildAndInject
- [ ] 21-02: Tableaux markdown via ApiTable dans buildAndInject

### Phase 22: Extraction Pipeline et Contrat Marqueurs
**Goal**: Le plugin OO scanne proactivement la selection et envoie a Scribe du markdown enrichi contenant des marqueurs normalises pour les images et cellules de tableaux
**Depends on**: Phase 20 (plugin infrastructure existante)
**Requirements**: EXTR-01, EXTR-02, EXTR-04, MARK-01, MARK-02
**Success Criteria** (what must be TRUE):
  1. Quand l'utilisateur selectionne du texte contenant une image, le markdown recu par Scribe contient un marqueur image (![IMG:id](placeholder) pour bloc, {{IMG:id}} pour inline) a l'emplacement correct
  2. Quand l'utilisateur selectionne du texte contenant un tableau, le markdown recu par Scribe contient des marqueurs [CELL:r,c]...[/CELL] pour chaque cellule avec le texte de la cellule
  3. Le pre-scan s'execute a chaque changement de selection (proactivement) sans delai perceptible pour l'utilisateur
  4. Le markdown enrichi pour du texte simple (sans objets complexes) est equivalent a l'ancien htmlToMarkdown -- pas de regression
**Plans**: 2 plans

Plans:
- [ ] 22-01: Pre-scan callCommand + markdown generation basique (texte, inline formatting)
- [ ] 22-02: Detection images (SetName) + marqueurs; detection tableaux + marqueurs cellule

### Phase 23: Image Round-Trip
**Goal**: Les images dans la selection survivent au round-trip LLM -- le LLM voit un placeholder, l'utilisateur voit un indicateur visuel dans le preview, et l'image originale est reinjectee a sa position dans le document
**Depends on**: Phase 22 (extraction avec marqueurs image)
**Requirements**: MARK-05, REINJ-01
**Success Criteria** (what must be TRUE):
  1. Dans le panneau de preview Scribe, un placeholder visuel (icone ou badge) indique l'emplacement de chaque image -- l'utilisateur sait ou l'image sera reinseree
  2. Apres injection, chaque image originale reapparait dans le document OO a la position indiquee par le marqueur dans le resultat LLM
  3. Si le LLM deplace un marqueur image dans sa reponse (ex: reordonne des paragraphes), l'image suit le marqueur a sa nouvelle position
  4. L'image reinjectee est identique a l'originale (pas de degradation de qualite ou de redimensionnement)
**Plans**: 2 plans

Plans:
- [ ] 23-01: Placeholder visuel dans le preview markdown + parsing marqueurs image
- [ ] 23-02: Reinsertion image via Copy/AddDrawing dans buildAndInject

### Phase 24: Table Round-Trip
**Goal**: Les tableaux dans la selection survivent au round-trip LLM -- chaque cellule est traduite/modifiee individuellement et reinjectee dans le tableau OO original avec sa structure preservee
**Depends on**: Phase 22 (extraction avec marqueurs cellule), Phase 21 (ApiTable dans Builder API)
**Requirements**: EXTR-03, MARK-03, MARK-04, REINJ-02, REINJ-03
**Success Criteria** (what must be TRUE):
  1. Dans le panneau de preview Scribe, le tableau reconstitue a partir des cellules traduites s'affiche correctement en markdown (lignes, colonnes, contenu)
  2. Scribe valide que le nombre de cellules dans la reponse LLM correspond au nombre de cellules extraites -- une incoherence est signalee a l'utilisateur
  3. Apres injection, les cellules traduites remplacent le contenu des cellules du tableau OO original; la structure du tableau (bordures, fonds, largeurs, fusions) est preservee
  4. Le formatage de chaque cellule reinjectee combine le markdown (bold, italic, etc.) avec la police et taille du premier paragraphe de la cellule source
  5. Si la selection contient du texte + un tableau, les deux sont traites correctement (texte via le pipeline standard, tableau via le pipeline cellule)
**Plans**: 2 plans

Plans:
- [ ] 24-01: Parsing marqueurs cellule + validation coherence + reconstitution tableau preview
- [ ] 24-02: Reinsertion in-place dans le tableau OO avec formatage md + font/size source

## Progress

**Execution Order:**
Phases execute in numeric order: 21 -> 22 -> 23 -> 24

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
| 14. Navigation, clavier et micro-interactions | v2.2 | 2/2 | Complete | 2026-03-10 |
| 15. Panneau de resultat interactif | v2.2 | 1/1 | Complete | 2026-03-11 |
| 16. Drawer Scaffold + Breakpoint Split | v2.3 | 1/1 | Complete | 2026-03-12 |
| 17. Push Navigation + Adaptive Layout | v2.3 | 2/2 | Complete | 2026-03-15 |
| 18. Token Pipeline + Minimal Builder Injection | v2.4 | 2/2 | Complete | 2026-03-17 |
| 19. Extended Markdown Support | v2.4 | 2/2 | Complete | 2026-03-18 |
| 20. Injection Polish | v2.4 | 2/2 | Complete | 2026-03-20 |
| 21. Blocs Etendus | 1/2 | Complete    | 2026-03-20 | - |
| 22. Extraction Pipeline et Contrat Marqueurs | 2/2 | Complete    | 2026-03-20 | - |
| 23. Image Round-Trip | 2/2 | Complete    | 2026-03-20 | - |
| 24. Table Round-Trip | v2.5 | 0/2 | Not started | - |

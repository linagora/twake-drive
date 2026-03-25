# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v2.2 Ameliorations UX** -- Phases 14-15 (shipped 2026-03-11)
- ✅ **v2.3 Menu Responsive** -- Phases 16-17 (shipped 2026-03-15)
- ✅ **v2.4 Document Builder Injection** -- Phases 18-20 (shipped 2026-03-20)
- ✅ **v2.5 Objets Complexes et Blocs Etendus** -- Phases 21-24 (shipped 2026-03-23)
- **v2.6 Formatage Complet et References Documentaires** -- Phases 25-27

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

<details>
<summary>✅ v2.5 Objets Complexes et Blocs Etendus (Phases 21-24) -- SHIPPED 2026-03-23</summary>

- [x] Phase 21: Blocs Etendus (1/2 plans) -- completed 2026-03-20
- [x] Phase 22: Extraction Pipeline et Contrat Marqueurs (2/2 plans) -- completed 2026-03-20
- [x] Phase 23: Image Round-Trip (2/2 plans) -- completed 2026-03-20
- [x] Phase 23.1: OO SDK Patch (0/1 plans) -- not started
- [x] Phase 23.2: Image round-trip cleanup (1/1 plans) -- completed 2026-03-22
- [x] Phase 24: Table Round-Trip (2/2 plans) -- completed 2026-03-22
- [x] Phase 24.1: Table rearchitecture (2/2 plans) -- completed 2026-03-23

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

### v2.6 Formatage Complet et References Documentaires

**Milestone Goal:** Completer le support des formatages inline (souligne) et gerer les objets documentaires avances (selections partielles de tableaux, notes de bas de page, renvois vers des parties du document).

- [x] **Phase 25: Souligne (Underline)** - Support underline dans le pipeline extraction/reinjection existant (completed 2026-03-24)
- [x] **Phase 26: Selections Partielles de Tableaux** - Gestion des cas ou le tableau n'est pas entierement selectionne, avec detection d'ambiguite (completed 2026-03-25)
- [ ] **Phase 27: References Documentaires** - Detection et preservation des notes de bas de page et renvois internes dans le round-trip

## Phase Details

### Phase 25: Souligne (Underline)
**Goal**: Le souligne dans la selection OO survit au round-trip LLM -- extrait comme marqueur markdown, preserve par le LLM, reinjecte avec le formatage underline dans OO
**Depends on**: Phase 24.1 (pipeline extraction/injection existant)
**Requirements**: FMT-01
**Success Criteria** (what must be TRUE):
  1. Du texte souligne dans la selection OO apparait dans le markdown extrait avec un marqueur reconnaissable (ex: `<u>texte</u>` ou convention markdown)
  2. Apres traitement LLM, le texte souligne dans le resultat IA est reinjecte dans OO avec la propriete underline appliquee via Builder API
  3. Le souligne coexiste avec les autres formatages inline (bold, italic, strikethrough) sans regression -- un texte gras+souligne reste gras+souligne apres round-trip
**Plans:** 1/1 plans complete
Plans:
- [ ] 25-01-PLAN.md — Underline round-trip: extraction, markdown emission, injection, preview, and system prompt

### Phase 26: Selections Partielles de Tableaux
**Goal**: L'utilisateur peut selectionner une partie d'un tableau et Scribe traite correctement les cellules selectionnees ou signale clairement quand la selection est ambigue
**Depends on**: Phase 25 (sequential), Phase 24.1 (table round-trip existant)
**Requirements**: TBL-01, TBL-02
**Success Criteria** (what must be TRUE):
  1. Quand l'utilisateur selectionne un sous-ensemble de lignes/colonnes d'un tableau, Scribe extrait uniquement les cellules selectionnees et les traite via le pipeline LLM sans casser la structure du tableau complet
  2. Apres injection, seules les cellules selectionnees sont modifiees -- les cellules non selectionnees conservent leur contenu original intact
  3. Quand la selection coupe un tableau de maniere ambigue (ex: selection commence au milieu d'une cellule, ou ne couvre qu'une partie d'une ligne fusionnee), Scribe affiche un message clair a l'utilisateur expliquant le probleme
  4. La detection d'ambiguite ne bloque pas les cas non ambigus -- les selections partielles valides sont traitees normalement
**Plans:** 2/2 plans complete
Plans:
- [ ] 26-01-PLAN.md — Partial table detection and extraction (analyzeTableSelection + extractPartialTableCells)
- [ ] 26-02-PLAN.md — Injection, ambiguity UX, preview fix, and Insert-mode gating

### Phase 27: References Documentaires
**Goal**: Les notes de bas de page et les renvois vers des parties du document dans la selection sont detectes et preserves lors du round-trip LLM -- le LLM peut modifier le texte, mais les liens de reference restent intacts
**Depends on**: Phase 26 (sequential)
**Requirements**: REF-01, REF-02
**Success Criteria** (what must be TRUE):
  1. Quand la selection contient un appel de note de bas de page, le marqueur de renvoi est extrait et preserve dans le markdown -- le LLM voit un indicateur mais ne peut pas le casser
  2. Apres injection, l'appel de note pointe toujours vers la bonne note de bas de page dans le document OO -- le lien n'est pas rompu
  3. Quand la selection contient un renvoi vers une autre partie du document (cross-reference), le renvoi est detecte et preserve dans le round-trip -- le texte autour peut changer mais le lien de reference reste fonctionnel
  4. Les references documentaires coexistent avec les autres elements du pipeline (images, tableaux, inline formatting) sans regression
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 25 -> 26 -> 27

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
| 21. Blocs Etendus | v2.5 | 1/2 | Complete | 2026-03-20 |
| 22. Extraction Pipeline et Contrat Marqueurs | v2.5 | 2/2 | Complete | 2026-03-20 |
| 23. Image Round-Trip | v2.5 | 2/2 | Complete | 2026-03-20 |
| 23.1 OO SDK Patch | v2.5 | 0/1 | Not started | - |
| 23.2 Image round-trip cleanup | v2.5 | 1/1 | Complete | 2026-03-22 |
| 24. Table Round-Trip | v2.5 | 2/2 | Complete | 2026-03-22 |
| 24.1. Table rearchitecture | v2.5 | 2/2 | Complete | 2026-03-23 |
| 25. Souligne (Underline) | 1/1 | Complete    | 2026-03-24 | - |
| 26. Selections Partielles de Tableaux | 2/2 | Complete   | 2026-03-25 | - |
| 27. References Documentaires | v2.6 | 0/TBD | Not started | - |

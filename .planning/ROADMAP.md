# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- 🚧 **v2.2 Ameliorations UX** -- Phases 14-15 (in progress)

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

### 🚧 v2.2 Ameliorations UX (In Progress)

**Milestone Goal:** Ameliorer l'ergonomie de Scribe -- navigation clavier, interactions souris, et micro-interactions du bouton flottant et du panneau de resultat.

- [x] **Phase 14: Navigation, clavier et micro-interactions** - Raccourci, focus order, hover prevention, tooltip delay (completed 2026-03-10)
- [ ] **Phase 15: Panneau de resultat interactif** - Fenetre deplacable et redimensionnable

## Phase Details

### Phase 14: Navigation, clavier et micro-interactions
**Goal**: L'utilisateur navigue dans Scribe de maniere fluide au clavier et a la souris, sans conflits de raccourcis ni comportements inattendus
**Depends on**: Phase 13 (v2.1 complete)
**Requirements**: NAV-01, NAV-02, MOUSE-01, MICRO-01
**Success Criteria** (what must be TRUE):
  1. User presses Ctrl+Shift+I and Scribe opens -- Ctrl+I still triggers italic in OO as expected
  2. In the result panel, pressing Tab moves focus from Insert to Replace (left-to-right), and Shift+Tab does the reverse
  3. When the Scribe menu opens with the mouse cursor already over a menu item, that item is not highlighted until the mouse physically moves to a different item
  4. The floating button tooltip appears only after 1 second of continuous hover -- moving away before 1s prevents the tooltip from showing
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Keyboard shortcut Ctrl+Shift+I and result panel button order
- [ ] 14-02-PLAN.md — Mouse hover gating on menu and tooltip delay on floating button

### Phase 15: Panneau de resultat interactif
**Goal**: L'utilisateur peut repositionner et redimensionner la fenetre de resultat pour l'adapter a son flux de travail
**Depends on**: Phase 14
**Requirements**: MOUSE-02, MOUSE-03
**Success Criteria** (what must be TRUE):
  1. User can click and drag the result panel background to move the window to a different position -- dragging on buttons or text content does not trigger drag
  2. A subtle resize handle is visible in the bottom-right corner of the result panel
  3. User can drag the resize handle to make the result panel larger or smaller, and the content reflows accordingly
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 -> 15

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
| 14. Navigation, clavier et micro-interactions | 2/2 | Complete    | 2026-03-11 | - |
| 15. Panneau de resultat interactif | v2.2 | 0/? | Not started | - |

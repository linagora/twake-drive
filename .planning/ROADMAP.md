# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v2.2 Ameliorations UX** -- Phases 14-15 (shipped 2026-03-11)
- 🚧 **v2.3 Menu Responsive** -- Phases 16-17 (in progress)

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

### 🚧 v2.3 Menu Responsive (In Progress)

**Milestone Goal:** Rendre le menu Scribe responsive -- drawer plein ecran sur mobile avec navigation push pour les sous-menus, sans toucher au chemin desktop.

- [ ] **Phase 16: Drawer Scaffold + Breakpoint Split** - Fullscreen drawer on mobile with correct MUI configuration, desktop path unchanged
- [ ] **Phase 17: Push Navigation + Adaptive Layout** - Push submenu navigation, back button, adaptive prompt input inside drawer

## Phase Details

### Phase 16: Drawer Scaffold + Breakpoint Split
**Goal**: User on mobile sees Scribe open as a fullscreen drawer instead of a popover, with no layout shift or focus conflicts
**Depends on**: Phase 15
**Requirements**: RESP-01, RESP-05
**Success Criteria** (what must be TRUE):
  1. On a mobile viewport (<=768px), triggering Scribe opens a fullscreen bottom drawer instead of the centered popover
  2. The drawer uses cozy-ui `isMobile` breakpoint (not a custom media query or hardcoded width)
  3. Opening the drawer causes no scroll lock layout shift (no body reflow)
  4. On desktop viewport, the existing Popover behavior is completely unchanged -- same position, same flyout submenus, same interactions
  5. Tapping the backdrop closes the drawer
**Plans**: TBD

Plans:
- [ ] 16-01: Conditional container and drawer configuration

### Phase 17: Push Navigation + Adaptive Layout
**Goal**: User on mobile can navigate submenus via push navigation and use the prompt input without overflow
**Depends on**: Phase 16
**Requirements**: RESP-02, RESP-03, RESP-04
**Success Criteria** (what must be TRUE):
  1. Tapping a parent menu item (e.g., Translate) replaces the main list with the submenu items in-place inside the drawer
  2. A back button appears at the top of the submenu view, and tapping it returns to the main menu list
  3. The prompt input fills the full width of the drawer (no 500px overflow on narrow screens)
  4. Closing and reopening the drawer always shows the root menu (push navigation state resets on close)
  5. Hover handlers from the desktop flyout path do not fire on mobile -- only tap/click interactions apply
**Plans**: TBD

Plans:
- [ ] 17-01: ScribeDrawerMenu component with push navigation
- [ ] 17-02: Adaptive prompt input and mobile polish

## Progress

**Execution Order:**
Phases execute in numeric order: 16 → 17

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
| 16. Drawer Scaffold + Breakpoint Split | v2.3 | 0/1 | Not started | - |
| 17. Push Navigation + Adaptive Layout | v2.3 | 0/2 | Not started | - |

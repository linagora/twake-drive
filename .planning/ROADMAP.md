# Roadmap: Scribe pour OnlyOffice

## Milestones

- ✅ **v1.0 Scribe Interface Mock AI** -- Phases 1-6 (shipped 2026-03-03)
- ✅ **v2.0 Scribe Live AI** -- Phases 7-9 (shipped 2026-03-06)
- ✅ **v2.1 Formatage Riche** -- Phases 10-13 (shipped 2026-03-09)
- ✅ **v2.2 Ameliorations UX** -- Phases 14-15 (shipped 2026-03-11)
- ✅ **v2.3 Menu Responsive** -- Phases 16-17 (shipped 2026-03-15)
- 🚧 **v2.4 Document Builder Injection** -- Phases 18-20 (in progress)

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

### 🚧 v2.4 Document Builder Injection (In Progress)

**Milestone Goal:** Remplacer PasteHtml par l'API Document Builder OO pour injecter le resultat Scribe avec un controle fin sur chaque element -- pipeline Markdown-to-Builder, formatage inline et blocs, selection post-injection, smart spacing.

- [ ] **Phase 18: Token Pipeline + Minimal Builder Injection** - Prove the parse-outside-build-inside architecture with bold/italic paragraphs injected via Builder API
- [ ] **Phase 19: Extended Markdown Support** - Complete inline formatting (strikethrough, code spans, links) and block elements (headings, lists) via Builder API
- [ ] **Phase 20: Injection Polish** - Post-injection selection via sentinel markers and smart spacing at injection boundaries

## Phase Details

### Phase 18: Token Pipeline + Minimal Builder Injection
**Goal**: User can trigger Scribe and get AI results injected into the document via Builder API with bold/italic formatting and proper paragraph separation, in a single undo point
**Depends on**: Phase 17
**Requirements**: PARSE-01, PARSE-02, PARSE-03, INL-01, BLK-01, INJ-01
**Success Criteria** (what must be TRUE):
  1. When Scribe injects a multi-paragraph AI result, each paragraph appears as a separate OO paragraph (not newlines within a single paragraph)
  2. Bold, italic, and bold+italic text from the AI result appears with the correct OO formatting (SetBold, SetItalic) in the injected content
  3. The entire injection is undoable with a single Ctrl+Z (one undo point, not multiple)
  4. The Scribe React interface sends raw Markdown to the plugin -- no token format leaks across the boundary
  5. If the Builder API injection fails for any reason, PasteHtml fallback kicks in and the user still gets their result injected
**Plans:** 1/2 plans executed

Plans:
- [ ] 18-01-PLAN.md � Bundle marked + flattenTokens + View.jsx md field (token pipeline setup)
- [ ] 18-02-PLAN.md � buildAndInject + callCommand interpreter + PasteHtml fallback (Builder injection)

### Phase 19: Extended Markdown Support
**Goal**: User gets headings, bullet lists, numbered lists, strikethrough, code spans, and hyperlinks correctly rendered as native OO elements when Scribe injects AI results
**Depends on**: Phase 18
**Requirements**: INL-02, INL-03, INL-04, BLK-02, BLK-03, BLK-04
**Success Criteria** (what must be TRUE):
  1. Headings (H1 through H6) in the AI result are injected with the corresponding OO heading styles, visually distinct from body text
  2. Bullet lists and numbered lists (including nested levels) are injected as native OO lists with proper indentation, not plain text with dashes or numbers
  3. Links in the AI result are injected as clickable OO hyperlinks (Ctrl+click opens the URL)
  4. Strikethrough text appears with OO strikethrough formatting and code spans appear in a monospace font
**Plans:** 1/2 plans executed

Plans:
- [ ] 19-01-PLAN.md — Headings + bullet lists + numbered lists (block elements)
- [ ] 19-02-PLAN.md — Strikethrough + code spans + hyperlinks (inline elements)

### Phase 20: Injection Polish
**Goal**: After injection, the user sees the injected content selected and the spacing around it is correct regardless of context (replace vs insert, mid-paragraph vs end)
**Depends on**: Phase 19
**Requirements**: INJ-02, INJ-03
**Success Criteria** (what must be TRUE):
  1. After clicking Replace or Insert, the injected content is visually selected (highlighted) in the OO editor -- the user can immediately see what was injected
  2. When replacing selected text, appropriate spaces are added at the boundaries so the injected content does not merge with adjacent words
  3. When inserting after a selection, appropriate line breaks separate the injected content from the existing text
  4. The selection and spacing work correctly for all content types (plain text, formatted text, lists, headings)
**Plans:** 2 plans

Plans:
- [ ] 20-01: Sentinel marker spike + post-injection selection implementation
- [ ] 20-02: Smart spacing for replace and insert modes

## Progress

**Execution Order:**
Phases execute in numeric order: 18 -> 19 -> 20

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
| 18. Token Pipeline + Minimal Builder Injection | 1/2 | In Progress|  | - |
| 19. Extended Markdown Support | 1/2 | In Progress|  | - |
| 20. Injection Polish | v2.4 | 0/2 | Not started | - |

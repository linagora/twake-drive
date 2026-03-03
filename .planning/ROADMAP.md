# Roadmap: Scribe pour OnlyOffice

## Milestones

- [x] **v1.0 Scribe Interface Mock AI** — Phases 1-6 (shipped 2026-03-03)
- [ ] **v2.0 Scribe Live AI** — Phases 7-9 (in progress)

## Phases

<details>
<summary>v1.0 Scribe Interface Mock AI (Phases 1-6) — SHIPPED 2026-03-03</summary>

- [x] Phase 1: Plugin OnlyOffice POC (2/2 plans) — completed 2026-02-28
- [x] Phase 2: Contextual Trigger and Communication Bridge (2/2 plans) — completed 2026-02-28
- [x] Phase 3: Scribe Interface with Mock AI (2/2 plans) — completed 2026-03-01
- [x] Phase 4: End-to-End Actions (covered by Phases 2-3) — completed 2026-03-01
- [x] Phase 5: Bouton Scribe flottant ancre a la selection (2/2 plans) — completed 2026-03-03
- [x] Phase 6: Affinement UI/UX (2/2 plans) — completed 2026-03-03

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v2.0 Scribe Live AI

- [ ] **Phase 7: Real AI Integration** — Replace mock transforms with live LLM calls via cozy-stack, with loading feedback and cancellation
- [ ] **Phase 8: Error Handling** — Graceful error states with retry for transient failures and clear messages for permanent ones
- [ ] **Phase 9: Internationalization** — All Scribe UI strings through cozy-ui i18n with full locale coverage

## Phase Details

### Phase 7: Real AI Integration
**Goal**: User gets real AI-generated text from Scribe actions instead of mock placeholders, with visual loading feedback
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: API-01, API-02, API-03, LOAD-01, LOAD-02
**Success Criteria** (what must be TRUE):
  1. User selects a Scribe action and sees real AI-transformed text in the result panel (not mock text)
  2. User sees a loading indicator between selecting an action and receiving the AI result
  3. Free-prompt action sends the user's custom instruction to the LLM and returns a real AI result
  4. User can close the popover while the AI is processing, which cancels the in-flight request
  5. Each Scribe action (rewrite, simplify, translate, etc.) sends the correct prompt structure to the API
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Error Handling
**Goal**: User receives clear, actionable feedback when AI requests fail, with retry for transient errors
**Depends on**: Phase 7
**Requirements**: ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. User sees a clear error message when the API call fails (network error, server 500, timeout)
  2. User can tap "Retry" after a transient error (429 rate limit, 500, network) and the request re-fires
  3. User sees a non-retryable message for auth/config errors (401, 403) without a retry button
  4. Error state does not break the popover — user can close and start a new action normally
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

### Phase 9: Internationalization
**Goal**: All Scribe UI text is translated via cozy-ui i18n for every supported locale
**Depends on**: Phase 7
**Requirements**: I18N-01, I18N-02, I18N-03
**Success Criteria** (what must be TRUE):
  1. No hardcoded French or English strings remain in any Scribe component
  2. Switching the Cozy locale changes all Scribe UI text (action labels, buttons, tooltips, error messages)
  3. Translation files exist for all cozy-ui supported locales
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

## Progress

**Execution Order:** 7 -> 8 -> 9 (Phase 9 depends only on 7, could run in parallel with 8)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Plugin OnlyOffice POC | v1.0 | 2/2 | Complete | 2026-02-28 |
| 2. Contextual Trigger and Communication Bridge | v1.0 | 2/2 | Complete | 2026-02-28 |
| 3. Scribe Interface with Mock AI | v1.0 | 2/2 | Complete | 2026-03-01 |
| 4. End-to-End Actions | v1.0 | 0/0 | Complete | 2026-03-01 |
| 5. Bouton Scribe flottant | v1.0 | 2/2 | Complete | 2026-03-03 |
| 6. Affinement UI/UX | v1.0 | 2/2 | Complete | 2026-03-03 |
| 7. Real AI Integration | v2.0 | 0/? | Not started | - |
| 8. Error Handling | v2.0 | 0/? | Not started | - |
| 9. Internationalization | v2.0 | 0/? | Not started | - |

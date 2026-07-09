# Deferred Items — Phase v3.1-03

Out-of-scope discoveries logged during execution. NOT fixed (SCOPE BOUNDARY: only
auto-fix issues directly caused by the current task's changes).

## v3.1-03-02 (Plan 02)

- **Pre-existing failing test: `ScribeContainer.spec.jsx` (1 failure)**
  - Test: `ScribeContainer` mobile Drawer `PaperProps.style` expects
    `{ height: '100%', borderRadius: 0 }` but the component now emits
    `{ borderRadius: '12px 12px 0 0', display: 'flex', flexDirection: 'column', maxHeight: '85vh', overflow: 'auto' }`.
  - Cause: `ScribeContainer.jsx` was updated for the responsive bottom-drawer
    (MEMORY.md "Phase 16 — Responsive Drawer (IN PROGRESS — NOT COMMITTED)") but
    its spec was not updated to match. Unrelated to the probe wiring in this plan.
  - Files: `src/modules/views/OnlyOffice/Scribe/ScribeContainer.{jsx,spec.jsx}` — NEITHER touched by Plan 02.
  - Verified pre-existing: failure reproduces running `npx jest ScribeContainer.spec.jsx`
    in isolation (depends only on the untouched ScribeContainer.jsx).
  - Disposition: defer — owner of Phase 16 responsive-drawer work should update the spec.

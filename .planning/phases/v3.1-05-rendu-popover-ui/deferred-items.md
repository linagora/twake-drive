# Deferred items — Phase v3.1-05

## Pre-existing test failure (out of scope for v3.1-05-01)

- **Suite:** `src/modules/views/OnlyOffice/Scribe/ScribeContainer.spec.jsx`
- **Failing test:** asserts a container style `objectContaining({ height: '100%', borderRadius: 0 })` (~line 130-133).
- **Status:** PRE-EXISTING. `ScribeContainer.jsx` and `ScribeContainer.spec.jsx` are unchanged at HEAD and are NOT modified by plan v3.1-05-01 (which only touched `ScribePopover.jsx` + `ScribeResultPanel.jsx`).
- **Action taken:** none (scope boundary — not caused by this task's changes). Logged for a future maintenance pass.

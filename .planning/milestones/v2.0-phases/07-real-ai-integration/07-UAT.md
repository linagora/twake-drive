---
status: complete
phase: 07-real-ai-integration
source: 07-01-SUMMARY.md, 07-02-SUMMARY.md
started: 2026-03-05T09:31:00Z
updated: 2026-03-05T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Real AI Text from Scribe Action
expected: Select text in the OO editor, open Scribe, choose an action (e.g. grammar correction or rewrite). The result panel shows real AI-generated transformed text — not the old mock placeholder.
result: pass

### 2. Loading Indicator During Processing
expected: After selecting a Scribe action, a spinner appears with an action-specific loading message (e.g. "Correction en cours..." or "Reformulation en cours...") while waiting for the AI response.
result: pass

### 3. Free-Prompt with Custom Instruction
expected: Select text, open Scribe, type a custom instruction in the prompt input (e.g. "Make this more formal"), submit. The result panel shows AI-generated text that follows the custom instruction.
result: pass

### 4. Cancel by Closing Popover During Loading
expected: Select text, trigger a Scribe action, then close the popover while the spinner is still showing. No error appears afterward, and the editor remains functional. Re-opening Scribe shows the menu (not a stale loading/result state).
result: issue -> fixed
reported: "ça ne marche pas, pour que ça marche, il faut que cliquer sur le pannel avec le spinner et là pressre sur esc fonctionne : c'est sans doute que le focus n'est pas dans le panel ou pas au bon endroit."
severity: major
fix: "Added tabIndex={-1} and auto-focus on loading panel Paper via useEffect on step change"

### 5. Translate Action Produces Translated Text
expected: Select text, open Scribe, choose Translate > a target language (e.g. English). The result panel shows the selected text translated into the chosen language by the AI.
result: pass

## Summary

total: 5
passed: 4
issues: 1 (fixed)
pending: 0
skipped: 0

## Gaps

- truth: "User can close the popover while AI is processing by pressing Esc without needing to click the loading panel first"
  status: failed
  reason: "User reported: ça ne marche pas, pour que ça marche, il faut que cliquer sur le pannel avec le spinner et là pressre sur esc fonctionne : c'est sans doute que le focus n'est pas dans le panel ou pas au bon endroit."
  severity: major
  test: 4
  root_cause: "When step transitions from 'menu' to 'loading', the ScribeActionMenu unmounts and nothing focuses the loading Paper. The Popover has disableAutoFocus/disableEnforceFocus, so onClose (which handles Esc) only fires when a child element has focus. User must click the loading panel first to give it focus before Esc works."
  artifacts:
    - path: "src/modules/views/OnlyOffice/Scribe/ScribePopover.jsx"
      issue: "Loading panel (Paper) has no tabIndex and receives no focus when step becomes 'loading'"
  missing:
    - "Add a ref to the loading panel Paper, set tabIndex=-1, and focus it when step transitions to 'loading'"
  debug_session: ""

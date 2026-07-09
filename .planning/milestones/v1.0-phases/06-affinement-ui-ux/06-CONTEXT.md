# Phase 6: Affinement UI/UX - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning (revised)

<domain>
## Phase Boundary

Two focused improvements to the Scribe interface:
1. Result panel sizing — dynamic height/width adapted to content instead of fixed dimensions
2. Menu parameterization — declarative config for all actions/submenus/prompts, with AI prompt definitions per action

No visual theme changes, no animations, no repositioning work in this phase.

</domain>

<decisions>
## Implementation Decisions

### Result Panel Sizing
- Panel height must adapt to content length (grow/shrink)
- Define sensible min-height (~80px) and max-height (~400px or 60vh) to prevent extreme cases
- Width should also be content-aware or match the menu+prompt layout width rather than fixed 380px
- Overflow-y: auto when content exceeds max-height (already in place)
- Transition on height changes for smooth resize when content updates

### Menu Parameterization — Declarative Config
- Extract the full action tree (currently SCRIBE_ACTIONS in scribeActions.js) into a clean declarative structure
- Each action entry defines: id, label, icon, children (submenu items), and associated AI prompt
- Submenu items also carry their own prompt definition
- The free-prompt input remains special (user-typed prompt) but its system prompt prefix should be configurable
- Keep dynamic translate children logic (buildTranslateChildren) but integrate it into the same config structure
- Config stays in JS (not JSON) since it references cozy-ui icon components

### Menu Parameterization — AI Prompts per Action
- Each action/sub-action gets a `prompt` field: the system/user prompt template sent to the Scribe API
- Prompt templates can reference `{selectedText}` as a placeholder for the user's selection
- Free-prompt action: template is just the user's input, optionally with a system prefix
- Translate actions: prompt template includes target language (e.g., `Translate the following text to {language}: {selectedText}`)
- This prepares the ground for real API integration (replacing mockTransform) without actually calling any API yet
- mockTransform should read prompts from the config rather than having its own switch/case logic

### Claude's Discretion
- Exact min/max dimensions for result panel
- Whether to use CSS transitions or JS-driven animation for panel resize
- Prompt template syntax (simple string interpolation vs template literals)
- How to structure the config file (single export vs factory function)
- Whether to split config into separate files (actions.js, prompts.js) or keep unified

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scribeActions.js`: current declarative action tree — already has id, label, icon, children structure. Needs prompt field added.
- `mockTransform.js`: current mock transformation logic — switch/case on actionId. Should be refactored to read from action config.
- `ScribeResultPanel.jsx`: current result display — uses Stylus for layout (scribe.styl), fixed 380px width, max-height 300px.
- `scribe.styl`: `.scribe-result-panel` (padding 16px, width 380px), `.scribe-result-text` (max-height 300px, monospace, pre-wrap)

### Established Patterns
- Action tree is already declarative (SCRIBE_ACTIONS array with id/label/icon/children)
- Dynamic children generation for translate (buildTranslateChildren)
- ScribeActionMenu reads from SCRIBE_ACTIONS and renders via .map()
- mockTransform uses actionId string matching — easy to refactor

### Integration Points
- ScribeActionMenu imports SCRIBE_ACTIONS from scribeActions.js
- ScribePopover calls mockTransform(actionId, selectedText) on action select
- Result text flows: mockTransform → setResult → ScribeResultPanel.resultText prop
- Future: mockTransform will be replaced by real API call, prompt field from config will be sent to API

</code_context>

<specifics>
## Specific Ideas

- The config should be the single source of truth for what Scribe can do — adding a new action = adding one entry to the config
- Prompt templates should be human-readable (a developer should understand what each action does by reading the config)

</specifics>

<deferred>
## Deferred Ideas

- Visual theme tokenization (dark theme, cozy-ui palette) — separate phase
- Animations & transitions (menu→result, floating button) — separate phase
- Positioning & resize handling — separate phase

</deferred>

---

*Phase: 06-affinement-ui-ux*
*Context gathered: 2026-03-03 (revised)*

# Phase 12: Preview Markdown - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Render the LLM's Markdown response as formatted text in the result panel (ScribeResultPanel) instead of displaying it as plain text. The preview must respect the Scribe MUI theme in both dark and light modes. This phase does NOT cover reinjection into OO (Phase 13) or editing the result before insertion.

</domain>

<decisions>
## Implementation Decisions

### Rendering approach
- Use `react-markdown` as the rendering component (not dangerouslySetInnerHTML + marked)
- Enable GFM support via `remark-gfm` plugin (tables, strikethrough, task lists)
- No syntax highlighting for code blocks — monospace background only
- All results always pass through react-markdown — no conditional plain text fallback, no detection logic

### Markdown styling
- Scaled wrapper approach: a container div applies a reduced font-size coefficient (~0.85em or similar) so all Markdown elements (headings, paragraphs, lists) scale down proportionally to fit the compact result panel
- No per-element MUI component mapping — react-markdown renders standard HTML elements, the wrapper handles sizing
- All theme colors from MUI theme tokens: text color, link color, code block background, table backgrounds — fully theme-aware via `theme.palette` for dark/light mode consistency

### Content overflow
- Horizontal scroll per block: tables and code blocks individually get `overflow-x: auto`, rest of content wraps normally
- Slightly increase max-width from 700px to ~800px to give tables more room
- Keep existing max-height: `min(500px, 70vh)` with `overflow-y: auto`
- Natural list nesting — no depth cap, indentation scales with the wrapper font-size

### Claude's Discretion
- Exact font-size scaling coefficient
- Specific theme.palette tokens for code/table backgrounds
- Internal structure of the Markdown wrapper component

</decisions>

<specifics>
## Specific Ideas

- User explicitly preferred a zoom/scale coefficient on the wrapper over per-element MUI Typography mapping — simpler and more uniform
- `marked` is already a dependency (v17) but react-markdown is the chosen renderer for the preview (marked stays for Phase 13 reinjection HTML conversion)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scribeConversion.js`: has `markdownToHtml()` using marked — not used for preview but relevant for Phase 13
- `ScribeResultPanel.jsx`: target component, currently renders `resultText` as plain string in a div
- MUI `useTheme()` already imported in ScribeResultPanel
- `scribe.styl`: has `.scribe-result-text` with max-height/overflow-y styling

### Established Patterns
- Scribe components use MUI Paper, Typography, Buttons from cozy-ui
- Inline styles preferred over stylus for portal/dynamic components (from Phase 5 findings)
- Theme-aware styling via `useTheme()` hook + inline `style` props

### Integration Points
- `ScribePopover.jsx` passes `result.text` to `ScribeResultPanel` as `resultText` prop — this is the Markdown string from the LLM
- `ScribeResultPanel` prop `resultText` (currently `PropTypes.string`) will render through react-markdown instead of as plain text
- New dependencies needed: `react-markdown`, `remark-gfm`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-preview-markdown*
*Context gathered: 2026-03-07*

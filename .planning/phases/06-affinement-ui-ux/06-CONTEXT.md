# Phase 6: Affinement UI/UX - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the Scribe interface (floating button, popover, action menu, prompt input, result panel) to align with cozy-ui design system and achieve production-quality look — styles, spacing, icons, animations, dark theme support, and repositioning on resize/scroll. No new features or capabilities.

</domain>

<decisions>
## Implementation Decisions

### Visual Style & Colors
- Replace all hardcoded colors with cozy-ui theme tokens (useTheme palette)
- Floating button: use theme palette for background/text instead of hardcoded white/#333
- Sparkle icon: keep purple accent but source from theme's primary/secondary palette
- Prompt send button: replace hardcoded #D6DEFF/#5B6FC0 with theme action colors
- Menu/result panel shadows: use cozy-ui Paper elevation instead of hardcoded boxShadow strings
- Typography: use cozy-ui Typography variants consistently (body2 for menu items, caption for breadcrumbs)
- Widths: keep current proportions (menu ~220px, prompt ~500px, result ~380px) but consider making prompt width responsive

### Dark Theme Support
- All components must work with OO dark theme — no hardcoded white backgrounds or dark text
- Floating button: theme-aware background (Paper surface color) and text color
- Tooltip: theme-aware background/text (currently hardcoded #333/white)
- Submenu Paper: inherit theme background automatically
- Result text area: use theme palette.action.hover (already partially done)
- Custom language input: ensure placeholder and text colors adapt to theme

### Animations & Transitions
- Floating button: fade-in/fade-out on show/hide (opacity transition, ~200ms)
- Menu → result step: cross-fade or slide transition (subtle, not distracting)
- Submenu opening: slide-in from left (~150ms ease-out)
- Popover appearance: keep MUI Popover's default Grow transition
- Keep all transitions under 300ms for snappy feel

### Positioning & Resize
- Popover: keep centered positioning for now (anchoring near selection is complex with OO's iframe architecture)
- Floating button: keep fixed bottom-right but verify it stays visible on window resize
- Test that popover doesn't clip or overflow on small viewports
- If window is very narrow (<600px), consider reducing prompt input width

### Claude's Discretion
- Exact transition timing curves and durations
- Whether to add subtle hover effects on menu items beyond current ListItem selected state
- Icon sizing adjustments for visual balance
- Padding/margin fine-tuning within components
- Whether result panel font should stay monospace or switch to body font
- Whether to add a subtle border to the floating button for better visibility on light backgrounds

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useTheme()` from cozy-ui: already imported in ScribeActionMenu and ScribeResultPanel, can extend to all components
- cozy-ui Paper: provides themed elevation and background colors automatically
- cozy-ui Typography: consistent font sizing/weight system
- cozy-ui Buttons: themed button variants (already used in ResultPanel)
- cozy-ui ListItem: themed selection/hover states (already used in ActionMenu)
- Stylus (scribe.styl): minimal usage, could expand or replace with inline styles

### Established Patterns
- Inline styles preferred for portal-rendered components (ScribeFloatingButton) — Stylus doesn't apply reliably across iframe boundaries
- cozy-ui component composition (Paper + ListItem + Typography) for menu structures
- `useTheme()` for dark/light mode detection via `theme.palette.type` or `theme.palette.mode`
- React portal on document.body for z-index management (floating button)

### Integration Points
- ScribeFloatingButton rendered as portal on document.body — must handle theme context propagation
- ScribePopover uses MUI Popover component — transitions and positioning controlled via MUI props
- OO editor iframe has very high z-index — floating button z-index 100000 must be preserved
- Theme context comes from CozyUI provider — verify it reaches portal-rendered elements

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches aligned with cozy-ui design system and Notion AI-style clean aesthetic (minimal chrome, subtle shadows, focused interactions).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-affinement-ui-ux*
*Context gathered: 2026-03-03*

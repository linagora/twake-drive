# Phase 12: Preview Markdown - Research

**Researched:** 2026-03-07
**Domain:** Markdown rendering in React (react-markdown + MUI theming)
**Confidence:** HIGH

## Summary

This phase replaces the plain-text display of LLM results in `ScribeResultPanel` with rendered Markdown using `react-markdown` and `remark-gfm`. The user locked the rendering approach (react-markdown, not dangerouslySetInnerHTML), the styling strategy (scaled wrapper div, not per-element MUI mapping), and overflow handling (per-block horizontal scroll for tables/code).

The main technical concern is ESM compatibility. `react-markdown` v9+ and `remark-gfm` v4+ are ESM-only packages. The project uses `rsbuild` for bundling (handles ESM fine) but Jest with `@swc/jest` in a CJS environment (needs `transformIgnorePatterns` updates). The project already solved this pattern for `marked` -- the same approach applies here but with a longer list of transitive ESM dependencies.

**Primary recommendation:** Install `react-markdown@^9` and `remark-gfm@^4`, create a `MarkdownPreview` wrapper component with scaled font-size and theme-aware inline styles, replace the `{error || resultText}` line in `ScribeResultPanel` with `<MarkdownPreview>`, and update `transformIgnorePatterns` in `jest.config.js`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `react-markdown` as the rendering component (not dangerouslySetInnerHTML + marked)
- Enable GFM support via `remark-gfm` plugin (tables, strikethrough, task lists)
- No syntax highlighting for code blocks -- monospace background only
- All results always pass through react-markdown -- no conditional plain text fallback, no detection logic
- Scaled wrapper approach: a container div applies a reduced font-size coefficient (~0.85em or similar) so all Markdown elements scale down proportionally
- No per-element MUI component mapping -- react-markdown renders standard HTML elements, the wrapper handles sizing
- All theme colors from MUI theme tokens via `theme.palette` for dark/light mode consistency
- Horizontal scroll per block: tables and code blocks individually get `overflow-x: auto`
- Slightly increase max-width from 700px to ~800px
- Keep existing max-height: `min(500px, 70vh)` with `overflow-y: auto`
- Natural list nesting -- no depth cap

### Claude's Discretion
- Exact font-size scaling coefficient
- Specific theme.palette tokens for code/table backgrounds
- Internal structure of the Markdown wrapper component

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREV-01 | Le panneau de resultat affiche le Markdown rendu (react-markdown) au lieu du texte brut | react-markdown + remark-gfm rendering pattern, MarkdownPreview component, ScribeResultPanel integration |
| PREV-02 | Le rendu Markdown utilise les tokens MUI du theme Scribe (dark/light mode) | Theme-aware inline styles via useTheme(), palette tokens for all elements |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^9 (latest 10.1.0) | React component to render Markdown as HTML | De facto standard for React Markdown rendering; ESM-only, React 18+ required (project uses 18.2.0) |
| remark-gfm | ^4 (latest 4.0.1) | GFM plugin for react-markdown | Adds tables, strikethrough, task lists, autolinks to react-markdown |

### Already Present
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| marked | ^17 | Markdown-to-HTML conversion | Used in Phase 13 for reinjection; NOT used for preview rendering |
| react-markdown | 4.3.1 (transitive) | Legacy transitive dep | Present in yarn.lock via other packages; do NOT reuse -- too old |

**Installation:**
```bash
yarn add react-markdown remark-gfm
```

## Architecture Patterns

### Component Structure
```
src/modules/views/OnlyOffice/Scribe/
  ScribeResultPanel.jsx   # Existing -- modified to use MarkdownPreview
  MarkdownPreview.jsx     # NEW -- wrapper component for react-markdown
  scribe.styl             # Existing -- max-width tweak (700px -> 800px)
```

### Pattern 1: MarkdownPreview Wrapper Component
**What:** A thin wrapper around `<ReactMarkdown>` that applies scaled font-size and theme-aware styles to all rendered Markdown elements via a container div.
**When to use:** Every time `resultText` is displayed in ScribeResultPanel (always -- no fallback to plain text per user decision).

```jsx
// MarkdownPreview.jsx
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

const MarkdownPreview = ({ children }) => {
  const theme = useTheme()
  const isDark = theme.palette.type === 'dark'

  const wrapperStyle = {
    fontSize: '0.85em',                          // Scale coefficient
    lineHeight: 1.5,
    color: theme.palette.text.primary,
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
  }

  return (
    <div style={wrapperStyle} className="scribe-markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

**Key styling targets** (applied via a `<style>` tag or inline component overrides):
- `pre`, `code`: monospace, background from `theme.palette.action.hover` or `theme.palette.grey[100]`/`grey[800]`
- `table`, `th`, `td`: borders from `theme.palette.divider`, header bg from `theme.palette.action.selected`
- `table`, `pre`: `overflow-x: auto` for horizontal scroll per block
- `a`: `color: theme.palette.primary.main`
- `blockquote`: left border, slightly muted text
- `h1`-`h6`, `p`, `ul`, `ol`: standard HTML elements with reduced margins (wrapper font-size handles scaling)

### Pattern 2: Styling Strategy -- Inline Styles via `components` Prop
**What:** Use react-markdown's `components` prop to apply inline styles to specific HTML elements for theme awareness, rather than external CSS.
**When to use:** For elements that need theme-dependent colors (code blocks, tables, links, blockquotes).

```jsx
const markdownComponents = {
  pre: ({ children, ...props }) => (
    <pre style={{
      backgroundColor: isDark ? theme.palette.grey[800] : theme.palette.grey[100],
      padding: '12px',
      borderRadius: '4px',
      overflowX: 'auto',
      margin: '8px 0',
    }} {...props}>{children}</pre>
  ),
  code: ({ children, ...props }) => {
    // Inline code (not inside pre)
    const isInline = !props.node?.position // or check parent
    if (isInline) {
      return (
        <code style={{
          backgroundColor: isDark ? theme.palette.grey[800] : theme.palette.grey[100],
          padding: '2px 4px',
          borderRadius: '3px',
          fontSize: '0.9em',
        }} {...props}>{children}</code>
      )
    }
    return <code {...props}>{children}</code>
  },
  table: ({ children, ...props }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{
        borderCollapse: 'collapse',
        width: '100%',
        fontSize: '0.95em',
      }} {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th style={{
      border: `1px solid ${theme.palette.divider}`,
      padding: '6px 10px',
      backgroundColor: isDark ? theme.palette.grey[800] : theme.palette.grey[50],
      textAlign: 'left',
    }} {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td style={{
      border: `1px solid ${theme.palette.divider}`,
      padding: '6px 10px',
    }} {...props}>{children}</td>
  ),
}
```

### Pattern 3: Integration into ScribeResultPanel
**What:** Replace the `{error || resultText}` expression with conditional rendering -- error stays as plain text, resultText goes through MarkdownPreview.
**Key change in ScribeResultPanel.jsx:**

```jsx
// Before:
{error || resultText}

// After:
{error ? error : <MarkdownPreview>{resultText}</MarkdownPreview>}
```

The existing `scribe-result-text` div wrapper stays (it handles max-height, overflow-y, padding, background). The `white-space: pre-wrap` and `font-family: monospace` in the stylus must be removed/overridden since react-markdown generates block-level HTML.

### Anti-Patterns to Avoid
- **Per-element MUI Typography mapping:** User explicitly rejected this. Don't map h1 to `<Typography variant="h1">`, etc. Use standard HTML elements with the wrapper scaling.
- **Conditional plain text fallback:** User decided all results always go through react-markdown, even if the result has no Markdown syntax.
- **dangerouslySetInnerHTML with marked:** User chose react-markdown specifically to avoid raw HTML injection.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex parser | react-markdown + remark-gfm | GFM tables, edge cases in nested lists, XSS safety |
| GFM tables | Custom table parser | remark-gfm plugin | Alignment, header detection, pipe escaping |
| HTML sanitization | Custom sanitizer | react-markdown (built-in) | react-markdown does not use dangerouslySetInnerHTML; it builds a React element tree |

**Key insight:** react-markdown already sanitizes by construction -- it creates React elements, not HTML strings. No need for a separate sanitization step.

## Common Pitfalls

### Pitfall 1: ESM-Only Packages in Jest
**What goes wrong:** `SyntaxError: Cannot use import statement outside a module` or `ERR_REQUIRE_ESM` when running tests.
**Why it happens:** react-markdown v9+, remark-gfm v4+, and their entire dependency tree (unified, remark-parse, rehype, micromark, mdast-util-*, hast-util-*, etc.) are ESM-only. The project's Jest config uses CJS.
**How to avoid:** Update `transformIgnorePatterns` in `jest.config.js` to include the full dependency tree:
```javascript
transformIgnorePatterns: [
  'node_modules/(?!cozy-ui|cozy-harvest-lib|cozy-keys-lib|cozy-sharing|marked|react-markdown|remark-gfm|unified|bail|devlop|is-plain-obj|trough|remark-.*|rehype-.*|hast-util-.*|mdast-util-.*|micromark.*|unist-.*|vfile|vfile-message|html-void-elements|zwitch|hastscript|web-namespaces|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities|ccount|escape-string-regexp|markdown-table|longest-streak|)',
  'jest-runner'
]
```
**Warning signs:** Test failures mentioning ESM imports; successful build but broken tests.

### Pitfall 2: Stylus `white-space: pre-wrap` Conflicts
**What goes wrong:** Markdown-rendered HTML respects `white-space: pre-wrap` from the parent `.scribe-result-text` class, causing paragraphs to not wrap properly or extra whitespace to appear.
**Why it happens:** The current stylus sets `white-space: pre-wrap` and `font-family: monospace` for plain text display.
**How to avoid:** Override these properties in the Markdown wrapper: `white-space: normal` and `font-family: inherit` (or set via the wrapper div's inline style).

### Pitfall 3: Missing `overflow-x: auto` on Block Elements
**What goes wrong:** Wide tables or code blocks overflow the result panel, breaking the layout or causing the entire panel to scroll horizontally.
**Why it happens:** Default HTML table/pre rendering has no overflow control.
**How to avoid:** Apply `overflow-x: auto` specifically to `table` (wrapped in a div) and `pre` elements via the `components` prop.

### Pitfall 4: Dark Mode Token Mismatch
**What goes wrong:** Code blocks or table headers look wrong in dark mode (e.g., dark text on dark background).
**Why it happens:** Using hardcoded colors instead of theme tokens, or using light-mode-only palette values.
**How to avoid:** Always use `theme.palette` tokens. Check `theme.palette.type === 'dark'` for conditional background selection. Test both modes.

### Pitfall 5: react-markdown Version Confusion
**What goes wrong:** Importing the transitive v4.3.1 instead of the newly installed version.
**Why it happens:** yarn.lock already has react-markdown@4.3.1 as a transitive dependency. Adding a direct `^9` dependency should resolve correctly, but verify.
**How to avoid:** After `yarn add react-markdown`, verify `node_modules/react-markdown/package.json` shows the expected version. The v4 API is completely different (different props, no `children` prop for content).

## Code Examples

### react-markdown Basic Usage (from official docs)
```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Content passed as children (string)
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {markdownString}
</ReactMarkdown>
```

### components Prop Shape
```jsx
// Each key is an HTML tag name, value is a React component
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    h1: ({ children, ...props }) => <h1 style={{...}} {...props}>{children}</h1>,
    a: ({ href, children, ...props }) => <a style={{...}} href={href} {...props}>{children}</a>,
    pre: ({ children, ...props }) => <pre style={{...}} {...props}>{children}</pre>,
    code: ({ children, inline, ...props }) => ...,
    table: ({ children, ...props }) => <div style={{overflowX:'auto'}}><table ...>{children}</table></div>,
    th: ...,
    td: ...,
  }}
>
  {content}
</ReactMarkdown>
```

### Theme-Aware Background Tokens (MUI)
```jsx
const theme = useTheme()
const isDark = theme.palette.type === 'dark'

// Code/table backgrounds
const codeBg = isDark ? theme.palette.grey[800] : theme.palette.grey[100]
const headerBg = isDark ? theme.palette.grey[800] : theme.palette.grey[50]
const borderColor = theme.palette.divider
const linkColor = theme.palette.primary.main
const textColor = theme.palette.text.primary
const mutedColor = theme.palette.text.secondary
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-markdown v4-6 (CJS) | react-markdown v9+ (ESM-only) | v7.0 (2021) | Must handle ESM in Jest |
| `source` prop | `children` prop | v7.0 | Content passed as children string |
| `renderers` prop | `components` prop | v6.0 | Custom element rendering |
| remark-gfm v1-3 | remark-gfm v4+ | v4.0 (2023) | ESM-only, unified ecosystem v11 |

**Deprecated/outdated:**
- `source` prop (v4): replaced by `children` in v6+
- `renderers` prop (v4-5): replaced by `components` in v6+
- `escapeHtml` prop: removed, react-markdown is safe by construction

## Open Questions

1. **Exact react-markdown version (9 vs 10)**
   - What we know: v9.x and v10.x both exist; v10.1.0 is latest
   - What's unclear: Whether v10 introduced breaking changes vs v9
   - Recommendation: Use `^9.0.0` for stability, or test with latest `^10` if no issues. The `components` API is stable across both.

2. **Full list of ESM transitive dependencies for transformIgnorePatterns**
   - What we know: The list is long (20+ packages) and version-dependent
   - What's unclear: Exact packages for the chosen version
   - Recommendation: Install first, then run tests. If ESM errors occur, add the failing package name to the pattern. Start with the comprehensive list from the Pitfalls section and trim if needed.

## Sources

### Primary (HIGH confidence)
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - API, components prop, ESM status
- [remark-gfm npm](https://www.npmjs.com/package/remark-gfm) - version, peer dependencies

### Secondary (MEDIUM confidence)
- [react-markdown issue #649](https://github.com/remarkjs/react-markdown/issues/649) - Jest ESM workaround with transformIgnorePatterns
- [remarkjs discussion #814](https://github.com/orgs/remarkjs/discussions/814) - Full transformIgnorePatterns list
- [singlehanded.dev components guide](https://www.singlehanded.dev/blog/understanding-the-components-prop-in-react-markdown) - components prop usage

### Project Sources (HIGH confidence)
- `ScribeResultPanel.jsx` - Current component structure, line 106-114 is the render target
- `scribe.styl` - Current styles that need modification (white-space, font-family, max-width)
- `jest.config.js` - Existing transformIgnorePatterns pattern (already includes `marked`)
- `package.json` - React 18.2.0, rsbuild build system, no direct react-markdown dep yet

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-markdown + remark-gfm is the clear standard; user locked this choice
- Architecture: HIGH - component structure is straightforward; wrapper + components prop well-documented
- Pitfalls: HIGH - ESM/Jest issue is well-known and already solved once in this project (marked); styling pitfalls are predictable from reading current code

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable domain, slow-moving libraries)

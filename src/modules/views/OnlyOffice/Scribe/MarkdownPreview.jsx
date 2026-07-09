import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { transformCellMarkersForPreview } from '@/modules/views/OnlyOffice/Scribe/tableCellMarkers'
import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

/**
 * MarkdownPreview - Renders Markdown text as formatted HTML.
 *
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown
 * (tables, strikethrough, task lists).
 *
 * Code block vs inline code styling is handled via CSS in scribe.styl
 * using `pre > code` vs `:not(pre) > code` selectors, avoiding the
 * react-markdown v10 limitation where block <code> without a language
 * has no className to distinguish it from inline <code>.
 */
const MarkdownPreview = ({ children }) => {
  const theme = useTheme()
  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'

  const components = {
    table: ({ node, children: tableChildren }) => (
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: '0.95em'
          }}
        >
          {tableChildren}
        </table>
      </div>
    ),
    th: ({ node, children: thChildren }) => (
      <th
        style={{
          border: `1px solid ${theme.palette.divider}`,
          padding: '6px 10px',
          background: isDark
            ? theme.palette.grey[800]
            : theme.palette.grey[50],
          textAlign: 'left'
        }}
      >
        {thChildren}
      </th>
    ),
    td: ({ node, children: tdChildren }) => (
      <td
        style={{
          border: `1px solid ${theme.palette.divider}`,
          padding: '6px 10px'
        }}
      >
        {tdChildren}
      </td>
    ),
    a: ({ node, children: aChildren, ...props }) => (
      <a style={{ color: theme.palette.primary.main }} {...props}>
        {aChildren}
      </a>
    ),
    blockquote: ({ node, children: bqChildren }) => (
      <blockquote
        style={{
          borderLeft: `3px solid ${theme.palette.divider}`,
          paddingLeft: 12,
          marginLeft: 0,
          color: theme.palette.text.secondary
        }}
      >
        {bqChildren}
      </blockquote>
    ),
    p: ({ node, children: pChildren }) => (
      <p style={{ margin: '4px 0' }}>{pChildren}</p>
    ),
    h1: ({ node, children: hChildren }) => (
      <h1 style={{ margin: '4px 0' }}>{hChildren}</h1>
    ),
    h2: ({ node, children: hChildren }) => (
      <h2 style={{ margin: '4px 0' }}>{hChildren}</h2>
    ),
    h3: ({ node, children: hChildren }) => (
      <h3 style={{ margin: '4px 0' }}>{hChildren}</h3>
    ),
    h4: ({ node, children: hChildren }) => (
      <h4 style={{ margin: '4px 0' }}>{hChildren}</h4>
    ),
    h5: ({ node, children: hChildren }) => (
      <h5 style={{ margin: '4px 0' }}>{hChildren}</h5>
    ),
    h6: ({ node, children: hChildren }) => (
      <h6 style={{ margin: '4px 0' }}>{hChildren}</h6>
    ),
    ul: ({ node, children: ulChildren }) => (
      <ul style={{ margin: '4px 0', paddingLeft: '2em' }}>{ulChildren}</ul>
    ),
    ol: ({ node, children: olChildren }) => (
      <ol style={{ margin: '4px 0', paddingLeft: '2em' }}>{olChildren}</ol>
    ),
    img: ({ node, alt, src, ...props }) => {
      const isPlaceholder =
        alt && /^IMG:scribe-img-\d+$/.test(alt) && src === 'placeholder'
      if (isPlaceholder) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.08)',
              fontSize: '0.85em',
              verticalAlign: 'middle'
            }}
          >
            <span style={{ opacity: 0.6 }}>&#128444;</span>
            <span style={{ opacity: 0.7 }}>{alt.replace('IMG:', '')}</span>
          </span>
        )
      }
      return <img alt={alt} src={src} {...props} />
    }
  }

  // Cosmetic, render-time-only preprocessing of plugin markers (D-02).
  // This is a DERIVED transform: it produces a NEW display string and never
  // mutates the caller's source `children` (D-03 invariant — the raw fragment
  // with markers intact is what the insert/replace/clipboard pipeline uses).
  let preprocessed = children
  if (typeof children === 'string') {
    let out = children

    // 1. Tables first (they wrap multiline blocks). Idempotency gate: only run
    //    when raw TABLE/CELL markers are present, so an already-converted GFM
    //    pipe-table (e.g. from the popover path) is left untouched.
    if (out.includes('[TABLE:') || out.includes('[CELL:')) {
      out = transformCellMarkersForPreview(out, '').displayMd
    }

    // 2. REF marker → visible text only. Bounded payload class `[^}]*` (linear,
    //    no nested quantifiers — ReDoS-safe). The captured text is placed as
    //    plain markdown text, not interpolated into any HTML tag/attribute.
    out = out.replace(/\{\{REF:scribe-ref-\d+:([^}]*)\}\}/g, '$1')

    // 3. Image marker → standard markdown image syntax (existing step; the `img`
    //    component override renders the placeholder chip).
    out = out.replace(/\{\{IMG:(scribe-img-\d+)\}\}/g, '![IMG:$1](placeholder)')

    // 4. Footnote marker → discreet superscript. Emitted raw HTML is a FIXED
    //    `<sup>` shell around a captured `\d+` only — no model-controlled
    //    substring reaches the tag/attribute (security V5). rehypeRaw renders it.
    out = out.replace(
      /\[\^scribe-fn-(\d+)\]/g,
      '<sup style="opacity:0.5">$1</sup>'
    )

    preprocessed = out
  }

  return (
    <div
      className={styles['scribe-md-preview']}
      style={{
        fontSize: '0.85em',
        lineHeight: 1.5,
        color: theme.palette.text.primary,
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
        fontFamily: 'inherit'
      }}
    >
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={components}>
        {preprocessed}
      </Markdown>
    </div>
  )
}

export { MarkdownPreview }

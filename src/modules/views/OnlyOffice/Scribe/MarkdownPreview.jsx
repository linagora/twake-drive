import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

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

  // Pre-process inline image markers to standard markdown image syntax
  const preprocessed =
    typeof children === 'string'
      ? children.replace(
          /\{\{IMG:(scribe-img-\d+)\}\}/g,
          '![IMG:$1](placeholder)'
        )
      : children

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

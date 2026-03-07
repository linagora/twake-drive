import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

/**
 * MarkdownPreview - Renders Markdown text as formatted HTML.
 *
 * Uses react-markdown with remark-gfm for GitHub Flavored Markdown
 * (tables, strikethrough, task lists). All colors use MUI theme tokens
 * for dark/light mode consistency.
 */
const MarkdownPreview = ({ children }) => {
  const theme = useTheme()
  const isDark = theme.palette.type === 'dark'

  const wrapperStyle = {
    fontSize: '0.85em',
    lineHeight: 1.5,
    color: theme.palette.text.primary,
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'normal',
    fontFamily: 'inherit'
  }

  const components = {
    pre: ({ node, children: preChildren }) => (
      <pre
        style={{
          background: isDark
            ? theme.palette.grey[800]
            : theme.palette.grey[100],
          padding: 12,
          borderRadius: 4,
          overflowX: 'auto',
          margin: '8px 0'
        }}
      >
        {preChildren}
      </pre>
    ),
    code: ({ node, inline, children: codeChildren, ...props }) => {
      // If parent is <pre>, render as block code (no extra styling)
      const isInline =
        inline !== undefined ? inline : !node?.position?.start?.column === 1
      if (!isInline && node?.parent?.tagName === 'pre') {
        return <code {...props}>{codeChildren}</code>
      }
      // Inline code
      return (
        <code
          style={{
            background: isDark
              ? theme.palette.grey[800]
              : theme.palette.grey[100],
            padding: '2px 4px',
            borderRadius: 3,
            fontSize: '0.9em'
          }}
          {...props}
        >
          {codeChildren}
        </code>
      )
    },
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
    )
  }

  return (
    <div style={wrapperStyle}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  )
}

export { MarkdownPreview }

import React, { useEffect, useRef, useCallback, useState } from 'react'
import PropTypes from 'prop-types'

import { useI18n } from 'twake-i18n'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import SyncIcon from 'cozy-ui/transpiled/react/Icons/Sync'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { MarkdownPreview } from '@/modules/views/OnlyOffice/Scribe/MarkdownPreview'
import { loadBeautify, loadHighlightJs } from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

/**
 * ScribeResultPanel - Step 2 of the Scribe two-step flow.
 *
 * Displays either the AI-transformed text (success) or an error message.
 * In dev mode (devData prop), shows 3 side-by-side panels:
 *   1. Source HTML (prettified + highlight.js syntax colored)
 *   2. Converted Markdown (highlight.js syntax colored)
 *   3. Rendered Markdown preview
 *
 * highlight.js is loaded lazily only when devData is present.
 */
const ScribeResultPanel = ({
  breadcrumb,
  resultText,
  error,
  canRetry,
  onRetry,
  onReplace,
  onInsert,
  onClose,
  devData
}) => {
  const { t } = useI18n()
  const theme = useTheme()
  const insertRef = useRef(null)
  const replaceRef = useRef(null)
  const closeRef = useRef(null)
  const retryRef = useRef(null)

  // Dev mode: highlighted HTML from highlight.js (loaded lazily from CDN)
  const [highlightedHtml, setHighlightedHtml] = useState('')
  const [highlightedMd, setHighlightedMd] = useState('')

  useEffect(() => {
    if (!devData) return

    Promise.all([loadHighlightJs(), loadBeautify()]).then(([hljs, beautify]) => {
      if (devData.html) {
        const pretty = beautify.html_beautify
          ? beautify.html_beautify(devData.html, { indent_size: 2, wrap_line_length: 80 })
          : beautify(devData.html, { indent_size: 2, wrap_line_length: 80 })
        setHighlightedHtml(hljs.highlight(pretty, { language: 'xml' }).value)
      }
      if (devData.md) {
        setHighlightedMd(
          hljs.highlight(devData.md, { language: 'markdown' }).value
        )
      }
    })
  }, [devData])

  const getFocusables = useCallback(() => {
    if (error && canRetry) {
      return [retryRef.current, closeRef.current].filter(Boolean)
    }
    if (error) {
      return [closeRef.current].filter(Boolean)
    }
    return [insertRef.current, replaceRef.current, closeRef.current].filter(
      Boolean
    )
  }, [error, canRetry])

  useEffect(() => {
    setTimeout(() => {
      if (error && canRetry && retryRef.current) {
        retryRef.current.focus()
      } else if (error && closeRef.current) {
        closeRef.current.focus()
      } else if (insertRef.current) {
        insertRef.current.focus()
      }
    }, 50)
  }, [error, canRetry])

  const handleKeyDown = useCallback(
    e => {
      const isNav =
        e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight'

      if (!isNav) return

      e.preventDefault()
      const items = getFocusables()
      if (items.length === 0) return

      const currentIndex = items.indexOf(document.activeElement)
      const backward = e.shiftKey || e.key === 'ArrowLeft'
      const next = backward
        ? (currentIndex - 1 + items.length) % items.length
        : (currentIndex + 1) % items.length

      items[next].focus()
    },
    [getFocusables]
  )

  const isDark = (theme.palette.type || theme.palette.mode) === 'dark'
  const codeBg = isDark ? '#1e1e1e' : '#f5f5f5'
  const codeColor = isDark ? '#d4d4d4' : '#333'

  const devColumnStyle = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column'
  }

  const devLabelStyle = {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
    marginBottom: 4,
    letterSpacing: '0.5px',
    flexShrink: 0
  }

  const devPreStyle = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: 12,
    borderRadius: 4,
    backgroundColor: codeBg,
    color: codeColor,
    fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'pre',
    margin: 0
  }

  const resultContent = (
    <div
      className={styles['scribe-result-text']}
      style={{
        backgroundColor: theme.palette.action.hover,
        ...(error ? { color: theme.palette.error.main } : {}),
        ...(devData ? { flex: 1, minWidth: 0, maxHeight: 'none' } : {})
      }}
    >
      {error ? error : <MarkdownPreview>{resultText}</MarkdownPreview>}
    </div>
  )

  return (
    <Paper
      className={styles['scribe-result-panel']}
      elevation={0}
      onKeyDown={handleKeyDown}
      style={
        devData
          ? {
              maxWidth: '95vw',
              width: 'auto',
              height: 'min(600px, 80vh)',
              display: 'flex',
              flexDirection: 'column'
            }
          : undefined
      }
    >
      <div
        className={styles['scribe-result-header']}
        style={devData ? { flexShrink: 0 } : undefined}
      >
        <Typography variant="subtitle2" color="textSecondary">
          {breadcrumb}
          {devData && (
            <span
              style={{ marginLeft: 8, color: '#ff9800', fontSize: 11 }}
            >
              DEV MD
            </span>
          )}
        </Typography>
        <IconButton ref={closeRef} size="small" onClick={onClose}>
          <Icon icon={CrossIcon} size={16} />
        </IconButton>
      </div>

      {devData ? (
        <div
          style={{
            display: 'flex',
            gap: 8,
            minWidth: 0,
            flex: 1,
            overflow: 'hidden'
          }}
        >
          <div style={devColumnStyle}>
            <div style={devLabelStyle}>HTML source</div>
            <pre
              className="hljs"
              style={devPreStyle}
              dangerouslySetInnerHTML={{
                __html:
                  highlightedHtml ||
                  (devData.html || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
              }}
            />
          </div>
          <div style={devColumnStyle}>
            <div style={devLabelStyle}>Markdown</div>
            <pre
              className="hljs"
              style={devPreStyle}
              dangerouslySetInnerHTML={{
                __html:
                  highlightedMd ||
                  devData.md
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
              }}
            />
          </div>
          <div style={devColumnStyle}>
            <div style={devLabelStyle}>Rendu</div>
            {resultContent}
          </div>
        </div>
      ) : (
        resultContent
      )}

      <div
        className={styles['scribe-result-actions']}
        style={devData ? { flexShrink: 0 } : undefined}
      >
        {error ? (
          <>
            {canRetry && onRetry && (
              <Buttons
                ref={retryRef}
                variant="text"
                label={t('Scribe.button.retry')}
                startIcon={<Icon icon={SyncIcon} />}
                onClick={onRetry}
              />
            )}
          </>
        ) : (
          <>
            <Buttons
              ref={replaceRef}
              variant="text"
              label={t('Scribe.button.replace')}
              onClick={onReplace}
            />
            <Buttons
              ref={insertRef}
              label={t('Scribe.button.insert')}
              onClick={onInsert}
            />
          </>
        )}
      </div>
    </Paper>
  )
}

ScribeResultPanel.propTypes = {
  breadcrumb: PropTypes.string.isRequired,
  resultText: PropTypes.string.isRequired,
  error: PropTypes.string,
  canRetry: PropTypes.bool,
  onRetry: PropTypes.func,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  devData: PropTypes.shape({
    html: PropTypes.string,
    md: PropTypes.string
  })
}

ScribeResultPanel.defaultProps = {
  error: '',
  canRetry: false,
  onRetry: undefined,
  devData: null
}

export { ScribeResultPanel }

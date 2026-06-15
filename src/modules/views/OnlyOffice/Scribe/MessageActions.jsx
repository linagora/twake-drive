import React, { useState, useRef, useCallback } from 'react'
import { useI18n } from 'twake-i18n'

import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useTheme } from 'cozy-ui/transpiled/react/styles'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { markdownToHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'

// Inline SVG icons (small, 16x16)
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const InsertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const ReplaceIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6l2-2 2 2M6 4v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10l-2 2-2-2M10 12V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8.5l3 3 7-7" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const stripParagraphWrapper = html => {
  const match = html.match(/^<p>(.*)<\/p>$/s)
  if (match && !match[1].includes('<p>')) return match[1]
  return html
}

const MessageActions = ({ content, hasSelection }) => {
  const theme = useTheme()
  const { t } = useI18n()
  const { panelActions } = useScribe()
  const [confirmedAction, setConfirmedAction] = useState(null)
  const timeoutRef = useRef(null)

  const showConfirmation = useCallback(action => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setConfirmedAction(action)
    timeoutRef.current = setTimeout(() => setConfirmedAction(null), 1500)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      const html = stripParagraphWrapper(markdownToHtml(content).trim())
      if (typeof ClipboardItem !== 'undefined') {
        const htmlBlob = new Blob([html], { type: 'text/html' })
        const textBlob = new Blob([content], { type: 'text/plain' })
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
        ])
      } else {
        await navigator.clipboard.writeText(content)
      }
      showConfirmation('copy')
    } catch (e) {
      // Clipboard write failed silently
    }
  }, [content, showConfirmation])

  const handleInsert = useCallback(() => {
    if (panelActions && panelActions.insert) {
      panelActions.insert(content)
      showConfirmation('insert')
    }
  }, [content, panelActions, showConfirmation])

  const handleReplace = useCallback(() => {
    if (panelActions && panelActions.replace) {
      panelActions.replace(content)
      showConfirmation('replace')
    }
  }, [content, panelActions, showConfirmation])

  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    padding: 0
  }

  const hoverProps = {
    onMouseEnter: e => {
      e.currentTarget.style.background = theme.palette.action.hover
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = 'transparent'
    }
  }

  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
      <Tooltip title={t('Scribe.button.copy')} enterDelay={600} enterNextDelay={600}>
        <button
          style={btnStyle}
          onClick={handleCopy}
          aria-label={t('Scribe.button.copy')}
          {...hoverProps}
        >
          {confirmedAction === 'copy' ? <CheckIcon /> : <CopyIcon />}
        </button>
      </Tooltip>
      <Tooltip title={t('Scribe.button.insert')} enterDelay={600} enterNextDelay={600}>
        <button
          style={btnStyle}
          onClick={handleInsert}
          aria-label={t('Scribe.button.insert')}
          {...hoverProps}
        >
          {confirmedAction === 'insert' ? <CheckIcon /> : <InsertIcon />}
        </button>
      </Tooltip>
      {hasSelection && (
        <Tooltip title={t('Scribe.button.replace')} enterDelay={600} enterNextDelay={600}>
          <button
            style={btnStyle}
            onClick={handleReplace}
            aria-label={t('Scribe.button.replace')}
            {...hoverProps}
          >
            {confirmedAction === 'replace' ? <CheckIcon /> : <ReplaceIcon />}
          </button>
        </Tooltip>
      )}
    </div>
  )
}

export default MessageActions

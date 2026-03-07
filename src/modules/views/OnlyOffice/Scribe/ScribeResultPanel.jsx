import React, { useEffect, useRef, useCallback } from 'react'
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
import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

/**
 * ScribeResultPanel - Step 2 of the Scribe two-step flow.
 *
 * Displays either the AI-transformed text (success) or an error message.
 * In error state, Insert/Replace buttons are hidden to prevent inserting error text.
 * A Retry button is shown for transient (retryable) errors.
 *
 * Focus is trapped between the available action buttons.
 * Tab/Shift+Tab and Arrow keys cycle through them.
 */
const ScribeResultPanel = ({
  breadcrumb,
  resultText,
  error,
  canRetry,
  onRetry,
  onReplace,
  onInsert,
  onClose
}) => {
  const { t } = useI18n()
  const theme = useTheme()
  const insertRef = useRef(null)
  const replaceRef = useRef(null)
  const closeRef = useRef(null)
  const retryRef = useRef(null)

  // Return the focusable buttons based on current state
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

  // Auto-focus the appropriate button on mount
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

  return (
    <Paper
      className={styles['scribe-result-panel']}
      elevation={0}
      onKeyDown={handleKeyDown}
    >
      <div className={styles['scribe-result-header']}>
        <Typography variant="subtitle2" color="textSecondary">
          {breadcrumb}
        </Typography>
        <IconButton ref={closeRef} size="small" onClick={onClose}>
          <Icon icon={CrossIcon} size={16} />
        </IconButton>
      </div>

      <div
        className={styles['scribe-result-text']}
        style={{
          backgroundColor: theme.palette.action.hover,
          ...(error ? { color: theme.palette.error.main } : {})
        }}
      >
        {error ? error : <MarkdownPreview>{resultText}</MarkdownPreview>}
      </div>

      <div className={styles['scribe-result-actions']}>
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
            <Buttons ref={insertRef} label={t('Scribe.button.insert')} onClick={onInsert} />
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
  onClose: PropTypes.func.isRequired
}

ScribeResultPanel.defaultProps = {
  error: '',
  canRetry: false,
  onRetry: undefined
}

export { ScribeResultPanel }

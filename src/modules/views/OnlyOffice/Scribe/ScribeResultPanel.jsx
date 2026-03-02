import React, { useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'

import { useTheme } from 'cozy-ui/transpiled/react/styles'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import CrossIcon from 'cozy-ui/transpiled/react/Icons/Cross'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Typography from 'cozy-ui/transpiled/react/Typography'

import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

/**
 * ScribeResultPanel - Step 2 of the Scribe two-step flow.
 *
 * Focus is trapped between Insert, Replace and Close (X) buttons.
 * Tab/Shift+Tab and Arrow keys cycle through them.
 */
const ScribeResultPanel = ({
  breadcrumb,
  resultText,
  onReplace,
  onInsert,
  onClose
}) => {
  const theme = useTheme()
  const insertRef = useRef(null)
  const replaceRef = useRef(null)
  const closeRef = useRef(null)

  // Order: Insert → Replace → Close → Insert ...
  const getFocusables = useCallback(
    () => [insertRef.current, replaceRef.current, closeRef.current].filter(Boolean),
    []
  )

  useEffect(() => {
    setTimeout(() => {
      if (insertRef.current) insertRef.current.focus()
    }, 50)
  }, [])

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
      style={{ borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
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
        style={{ backgroundColor: theme.palette.action.hover }}
      >
        {resultText}
      </div>

      <div className={styles['scribe-result-actions']}>
        <Buttons ref={replaceRef} variant="text" label="Replace" onClick={onReplace} />
        <Buttons ref={insertRef} label="Inserer" onClick={onInsert} />
      </div>
    </Paper>
  )
}

ScribeResultPanel.propTypes = {
  breadcrumb: PropTypes.string.isRequired,
  resultText: PropTypes.string.isRequired,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
}

export { ScribeResultPanel }

import React, { useState, useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import Popover from 'cozy-ui/transpiled/react/Popover'

import { ScribeActionMenu } from '@/modules/views/OnlyOffice/Scribe/ScribeActionMenu'
import { mockTransform } from '@/modules/views/OnlyOffice/Scribe/mockTransform'
import { ScribeResultPanel } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'

/**
 * ScribePopover - Main popover container managing the two-step state machine.
 *
 * Step 1 ('menu'): Action selection via ScribeActionMenu (submenus + free prompt).
 * Step 2 ('result'): Displays the mock-transformed text via ScribeResultPanel.
 *
 * Same prop interface as ScribeModal for drop-in replacement.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the popover is visible
 * @param {string} props.selectedText - Text selected in the editor
 * @param {Function} props.onReplace - Called with transformed text when Replace is clicked
 * @param {Function} props.onInsert - Called with transformed text when Inserer is clicked
 * @param {Function} props.onCancel - Called when closed without action
 */
const ScribePopover = ({ open, selectedText, onReplace, onInsert, onCancel }) => {
  const [step, setStep] = useState('menu') // 'menu' | 'result'
  const [result, setResult] = useState({ text: '', breadcrumb: '' })

  // Reset to menu state when popover opens with new intent
  useEffect(() => {
    if (open) {
      setStep('menu')
      setResult({ text: '', breadcrumb: '' })
    }
  }, [open])

  /**
   * Handle action selection from the menu.
   * Calls mockTransform, stores result, transitions to 'result' step.
   */
  const handleActionSelect = useCallback(
    (actionId, label, breadcrumb) => {
      const transformed = mockTransform(actionId, selectedText)
      setResult({ text: transformed, breadcrumb })
      setStep('result')
    },
    [selectedText]
  )

  const handleClose = useCallback(() => {
    onCancel()
  }, [onCancel])

  const handleReplace = useCallback(() => {
    onReplace(result.text)
  }, [result.text, onReplace])

  const handleInsert = useCallback(() => {
    onInsert(result.text)
  }, [result.text, onInsert])

  const menuRef = useRef(null)

  const handleEntered = useCallback(() => {
    // Blur the OO iframe to release focus, then focus the menu
    if (document.activeElement) {
      document.activeElement.blur()
    }
    setTimeout(() => {
      if (menuRef.current) {
        menuRef.current.focus()
      }
    }, 50)
  }, [])

  return (
    <Popover
      open={open}
      TransitionProps={{ onEntered: handleEntered }}
      disableAutoFocus
      disableEnforceFocus
      anchorReference="anchorPosition"
      anchorPosition={{ top: typeof window !== 'undefined' ? window.innerHeight / 2 : 400, left: typeof window !== 'undefined' ? window.innerWidth / 2 : 500 }}
      transformOrigin={{ vertical: 'center', horizontal: 'center' }}
      onClose={handleClose}
      BackdropProps={{ style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' } }}
      PaperProps={{
        style: {
          borderRadius: 8,
          boxShadow: 'none',
          backgroundColor: 'transparent',
          overflow: 'visible'
        }
      }}
    >
      {step === 'menu' ? (
        <ScribeActionMenu ref={menuRef} onSelect={handleActionSelect} onClose={handleClose} selectedText={selectedText} />
      ) : (
        <ScribeResultPanel
          breadcrumb={result.breadcrumb}
          resultText={result.text}
          onReplace={handleReplace}
          onInsert={handleInsert}
          onClose={handleClose}
        />
      )}
    </Popover>
  )
}

ScribePopover.propTypes = {
  open: PropTypes.bool.isRequired,
  selectedText: PropTypes.string.isRequired,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

export { ScribePopover }

import React, { useState, useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import Popover from 'cozy-ui/transpiled/react/Popover'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useClient } from 'cozy-client'

import { ScribeActionMenu } from '@/modules/views/OnlyOffice/Scribe/ScribeActionMenu'
import { callScribeAI, buildMessages, deriveLoadingMessage, classifyScribeError } from '@/modules/views/OnlyOffice/Scribe/scribeAI'
import { ScribeResultPanel } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'
import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

/**
 * ScribePopover - Main popover container managing the three-step state machine.
 *
 * Step 1 ('menu'): Action selection via ScribeActionMenu (submenus + free prompt).
 * Step 2 ('loading'): Spinner + action-specific loading message while AI processes.
 * Step 3 ('result'): Displays the AI-transformed text via ScribeResultPanel.
 *
 * Closing the popover during loading aborts the in-flight API request via AbortController.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the popover is visible
 * @param {string} props.selectedText - Text selected in the editor
 * @param {Function} props.onReplace - Called with transformed text when Replace is clicked
 * @param {Function} props.onInsert - Called with transformed text when Inserer is clicked
 * @param {Function} props.onCancel - Called when closed without action
 */
const ScribePopover = ({ open, selectedText, onReplace, onInsert, onCancel }) => {
  const client = useClient()
  const abortRef = useRef(null)

  const [step, setStep] = useState('menu') // 'menu' | 'loading' | 'result'
  const [result, setResult] = useState({ text: '', breadcrumb: '', error: '', canRetry: false })
  const [loadingMessage, setLoadingMessage] = useState('')
  const [lastAction, setLastAction] = useState(null)

  // Reset to menu state when popover opens with new intent
  useEffect(() => {
    if (open) {
      setStep('menu')
      setResult({ text: '', breadcrumb: '', error: '', canRetry: false })
      setLoadingMessage('')
      setLastAction(null)
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [open])

  // Focus the loading panel when step transitions to 'loading'
  useEffect(() => {
    if (step === 'loading' && loadingRef.current) {
      loadingRef.current.focus()
    }
  }, [step])

  /**
   * Handle action selection from the menu.
   * Calls callScribeAI with real prompts, shows loading state, transitions to 'result'.
   * For translate-custom, passes the user-typed language as extra.
   */
  const handleActionSelect = useCallback(
    async (actionId, label, breadcrumb) => {
      // Store action params for retry
      setLastAction({ actionId, label, breadcrumb })

      // 1. Transition to loading
      setStep('loading')
      setLoadingMessage(deriveLoadingMessage(actionId, label))
      setResult({ text: '', breadcrumb, error: '', canRetry: false })

      // 2. Create AbortController
      const controller = new AbortController()
      abortRef.current = controller

      try {
        // 3. Build messages and call API
        const extra = actionId === 'translate-custom' ? { language: label } : undefined
        const messages = buildMessages(actionId, selectedText, label, extra)
        const text = await callScribeAI(client, messages, { signal: controller.signal })

        // 4. Show result
        setResult({ text, breadcrumb, error: '', canRetry: false })
        setStep('result')
      } catch (err) {
        if (err.name === 'AbortError') {
          // User closed popover during loading — do nothing
          return
        }
        // Classify error for user-facing message and retry eligibility
        const classified = classifyScribeError(err)
        setResult({ text: '', breadcrumb, error: classified.message, canRetry: classified.canRetry })
        setStep('result')
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [selectedText, client]
  )

  const handleClose = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    onCancel()
  }, [onCancel])

  const handleReplace = useCallback(() => {
    onReplace(result.text)
  }, [result.text, onReplace])

  const handleInsert = useCallback(() => {
    onInsert(result.text)
  }, [result.text, onInsert])

  const handleRetry = useCallback(() => {
    if (lastAction) {
      handleActionSelect(lastAction.actionId, lastAction.label, lastAction.breadcrumb)
    }
  }, [lastAction, handleActionSelect])

  const menuRef = useRef(null)
  const loadingRef = useRef(null)

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
      {step === 'menu' && (
        <ScribeActionMenu ref={menuRef} onSelect={handleActionSelect} onClose={handleClose} selectedText={selectedText} />
      )}
      {step === 'loading' && (
        <Paper ref={loadingRef} tabIndex={-1} className={styles['scribe-loading-panel']} elevation={0} style={{ outline: 'none' }}>
          <Spinner size="large" />
          <Typography variant="body2" color="textSecondary" className={styles['scribe-loading-message']}>
            {loadingMessage}
          </Typography>
        </Paper>
      )}
      {step === 'result' && (
        <ScribeResultPanel
          breadcrumb={result.breadcrumb}
          resultText={result.text}
          error={result.error}
          canRetry={result.canRetry}
          onRetry={handleRetry}
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

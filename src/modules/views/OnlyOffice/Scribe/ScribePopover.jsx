import React, { useState, useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import Popover from 'cozy-ui/transpiled/react/Popover'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'
import { useClient } from 'cozy-client'

import { ScribeActionMenu } from '@/modules/views/OnlyOffice/Scribe/ScribeActionMenu'
import { callScribeAI, buildMessages, deriveLoadingMessage, classifyScribeError } from '@/modules/views/OnlyOffice/Scribe/scribeAI'
import { htmlToMarkdown, normalizeHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import { ScribeResultPanel } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'
import { isScribeDevMd } from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import styles from '@/modules/views/OnlyOffice/Scribe/scribe.styl'

/**
 * ScribePopover - Main popover container managing the three-step state machine.
 *
 * Step 1 ('menu'): Action selection via ScribeActionMenu (submenus + free prompt).
 * Step 2 ('loading'): Spinner + action-specific loading message while AI processes.
 * Step 3 ('result'): Displays the AI-transformed text via ScribeResultPanel.
 *
 * Closing the popover during loading aborts the in-flight API request via AbortController.
 */
const ScribePopover = ({ open, selectedText, selectedHtml, onReplace, onInsert, onCancel }) => {
  const { t } = useI18n()
  const client = useClient()
  const abortRef = useRef(null)

  const [step, setStep] = useState('menu') // 'menu' | 'loading' | 'result'
  const [result, setResult] = useState({ text: '', breadcrumb: '', error: '', canRetry: false })
  const [loadingMessage, setLoadingMessage] = useState('')
  const [lastAction, setLastAction] = useState(null)
  // Dev mode: store source HTML and intermediate MD for debug panels
  const [devData, setDevData] = useState({ html: '', md: '' })

  // Reset to menu state when popover opens with new intent
  useEffect(() => {
    if (open) {
      setStep('menu')
      setResult({ text: '', breadcrumb: '', error: '', canRetry: false })
      setLoadingMessage('')
      setLastAction(null)
      setDevData({ html: '', md: '' })
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

  const handleActionSelect = useCallback(
    async (actionId, label, breadcrumb) => {
      // Compute intermediate MD for dev panels
      const inputMd = selectedHtml ? htmlToMarkdown(selectedHtml) : selectedText

      // Compute normalized HTML for dev panels
      const normalized = selectedHtml ? normalizeHtml(selectedHtml) : ''

      // Dev mode: test-markdown bypasses LLM entirely
      if (actionId === 'test-markdown') {
        setDevData({ html: selectedHtml || '', normalizedHtml: normalized, md: inputMd })
        setResult({ text: inputMd, breadcrumb: 'Test MD', error: '', canRetry: false })
        setStep('result')
        return
      }

      // Store action params for retry
      setLastAction({ actionId, label, breadcrumb })

      // Capture dev data for normal flow too
      if (isScribeDevMd()) {
        setDevData({ html: selectedHtml || '', normalizedHtml: normalized, md: inputMd })
      }

      // 1. Transition to loading
      setStep('loading')
      const loadingInfo = deriveLoadingMessage(actionId, label)
      setLoadingMessage(loadingInfo.params ? t(loadingInfo.key, loadingInfo.params) : t(loadingInfo.key))
      setResult({ text: '', breadcrumb, error: '', canRetry: false })

      // 2. Create AbortController
      const controller = new AbortController()
      abortRef.current = controller

      try {
        // 3. Build messages and call API
        const extra = {}
        if (actionId === 'translate-custom') {
          extra.language = label
        }
        if (selectedHtml) {
          extra.html = selectedHtml
        }
        const messages = buildMessages(actionId, selectedText, label, Object.keys(extra).length > 0 ? extra : undefined)
        const text = await callScribeAI(client, messages, { signal: controller.signal })

        // 4. Show result
        setResult({ text, breadcrumb, error: '', canRetry: false })
        setStep('result')
      } catch (err) {
        if (err.name === 'AbortError') {
          return
        }
        const classified = classifyScribeError(err)
        setResult({ text: '', breadcrumb, error: classified.messageKey ? t(classified.messageKey) : '', canRetry: classified.canRetry })
        setStep('result')
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [selectedText, selectedHtml, client, t]
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
    if (document.activeElement) {
      document.activeElement.blur()
    }
    setTimeout(() => {
      if (menuRef.current) {
        menuRef.current.focus()
      }
    }, 50)
  }, [])

  const devMode = isScribeDevMd()

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
          overflow: 'visible',
          ...(devMode && step === 'result' ? { maxWidth: '95vw' } : {})
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
          devData={devMode ? devData : null}
        />
      )}
    </Popover>
  )
}

ScribePopover.propTypes = {
  open: PropTypes.bool.isRequired,
  selectedText: PropTypes.string.isRequired,
  selectedHtml: PropTypes.string,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

export { ScribePopover }

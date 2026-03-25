import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import PropTypes from 'prop-types'

import Alert from '@mui/material/Alert'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'
import { useClient } from 'cozy-client'

import { ScribeContainer } from '@/modules/views/OnlyOffice/Scribe/ScribeContainer'
import { ScribeActionMenu } from '@/modules/views/OnlyOffice/Scribe/ScribeActionMenu'
import { callScribeAI, buildMessages, deriveLoadingMessage, classifyScribeError } from '@/modules/views/OnlyOffice/Scribe/scribeAI'
import { htmlToMarkdown, normalizeHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import { transformCellMarkersForPreview } from '@/modules/views/OnlyOffice/Scribe/tableCellMarkers'
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
const ScribePopover = ({ open, selectedText, selectedHtml, enrichedMd, tableAmbiguity, partialTableInfo, onReplace, onInsert, onCancel }) => {
  const { t } = useI18n()
  const client = useClient()
  const abortRef = useRef(null)

  const [step, setStep] = useState('menu') // 'menu' | 'loading' | 'result'
  const [result, setResult] = useState({ text: '', breadcrumb: '', error: '', canRetry: false })
  const [loadingMessage, setLoadingMessage] = useState('')
  const [lastAction, setLastAction] = useState(null)
  // Dev mode: store source HTML and intermediate MD for debug panels
  const [devData, setDevData] = useState({ html: '', md: '' })
  // Raw LLM response (with cell markers) for reinjection; display version goes in result.text
  const [rawResult, setRawResult] = useState('')
  // Warning when cell marker count mismatches between extraction and LLM response
  const [cellWarning, setCellWarning] = useState(null)

  // Ambiguity message for partial table selections (TBL-02)
  const [ambiguityMessage, setAmbiguityMessage] = useState(null)

  // Drag offset for result panel repositioning
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  // Panel size for result panel resizing (null = use default CSS sizing)
  const [panelSize, setPanelSize] = useState(null)

  // Disable Insert when selection is purely a partial table (no surrounding text)
  const insertDisabled = useMemo(() => {
    if (!partialTableInfo || !enrichedMd) return false
    // Check if enrichedMd is ONLY table blocks (no text outside)
    const stripped = enrichedMd.replace(/\[TABLE:\d+\][\s\S]*?\[\/TABLE\]/g, '').trim()
    return stripped.length === 0
  }, [partialTableInfo, enrichedMd])

  // Reset to menu state when popover opens with new intent
  useEffect(() => {
    if (open) {
      setStep('menu')
      setResult({ text: '', breadcrumb: '', error: '', canRetry: false })
      setLoadingMessage('')
      setLastAction(null)
      setDevData({ html: '', md: '' })
      setRawResult('')
      setCellWarning(null)
      setAmbiguityMessage(null)
      setDragOffset({ x: 0, y: 0 })
      setPanelSize(null)
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
    }
  }, [open])

  // Detect ambiguous table selection and show warning instead of menu
  useEffect(() => {
    if (tableAmbiguity) {
      setAmbiguityMessage(tableAmbiguity.message)
    } else {
      setAmbiguityMessage(null)
    }
  }, [tableAmbiguity])

  // Focus the loading panel when step transitions to 'loading'
  useEffect(() => {
    if (step === 'loading' && loadingRef.current) {
      loadingRef.current.focus()
    }
  }, [step])

  const handleActionSelect = useCallback(
    async (actionId, label, breadcrumb) => {
      // Don't send ambiguous selections to LLM
      if (tableAmbiguity) return

      // Compute intermediate MD for dev panels (enrichedMd preferred over htmlToMarkdown)
      const inputMd = enrichedMd || (selectedHtml ? htmlToMarkdown(selectedHtml) : selectedText)

      // Compute normalized HTML for dev panels
      const normalized = selectedHtml ? normalizeHtml(selectedHtml) : ''

      // Dev mode: test-markdown bypasses LLM entirely
      if (actionId === 'test-markdown') {
        setDevData({ html: selectedHtml || '', normalizedHtml: normalized, md: inputMd, source: enrichedMd ? 'plugin' : 'turndown' })
        setResult({ text: inputMd, breadcrumb: 'Test MD', error: '', canRetry: false })
        setStep('result')
        return
      }

      // Store action params for retry
      setLastAction({ actionId, label, breadcrumb })

      // Capture dev data for normal flow too
      if (isScribeDevMd()) {
        setDevData({ html: selectedHtml || '', normalizedHtml: normalized, md: inputMd, source: enrichedMd ? 'plugin' : 'turndown' })
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
        if (enrichedMd) {
          extra.enrichedMd = enrichedMd
        }
        const messages = buildMessages(actionId, selectedText, label, Object.keys(extra).length > 0 ? extra : undefined)
        const text = await callScribeAI(client, messages, { signal: controller.signal })

        // 4. Pre-process cell markers for preview display, keep raw for reinjection
        const { displayMd, warning } = transformCellMarkersForPreview(text, enrichedMd)
        setRawResult(text)
        setCellWarning(warning)
        setResult({ text: displayMd, breadcrumb, error: '', canRetry: false })
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
    [selectedText, selectedHtml, enrichedMd, tableAmbiguity, client, t]
  )

  const handleClose = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    onCancel()
  }, [onCancel])

  const handleReplace = useCallback(() => {
    onReplace(rawResult || result.text)
  }, [rawResult, result.text, onReplace])

  const handleInsert = useCallback(() => {
    onInsert(rawResult || result.text)
  }, [rawResult, result.text, onInsert])

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
    <ScribeContainer
      open={open}
      onClose={handleClose}
      TransitionProps={{ onEntered: handleEntered }}
      disableAutoFocus
      disableEnforceFocus
      anchorReference="anchorPosition"
      anchorPosition={{ top: (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) + dragOffset.y, left: (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) + dragOffset.x }}
      transformOrigin={{ vertical: 'center', horizontal: 'center' }}
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
      {ambiguityMessage && step === 'menu' && (
        <Alert severity="warning" sx={{ m: 1, maxWidth: 400, borderRadius: 2 }}>
          {ambiguityMessage}
        </Alert>
      )}
      {step === 'menu' && !ambiguityMessage && (
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
          cellWarning={cellWarning}
          insertDisabled={insertDisabled}
          onRetry={handleRetry}
          onReplace={handleReplace}
          onInsert={handleInsert}
          onClose={handleClose}
          devData={devMode ? devData : null}
          dragOffset={dragOffset}
          onDragMove={setDragOffset}
          panelSize={panelSize}
          onResize={setPanelSize}
        />
      )}
    </ScribeContainer>
  )
}

ScribePopover.propTypes = {
  open: PropTypes.bool.isRequired,
  selectedText: PropTypes.string.isRequired,
  selectedHtml: PropTypes.string,
  enrichedMd: PropTypes.string,
  tableAmbiguity: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  partialTableInfo: PropTypes.object,
  onReplace: PropTypes.func.isRequired,
  onInsert: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
}

export { ScribePopover }

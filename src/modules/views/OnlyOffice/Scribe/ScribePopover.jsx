import React, { useState, useCallback, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import Alert from 'cozy-ui/transpiled/react/Alert'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import Typography from 'cozy-ui/transpiled/react/Typography'
import { useI18n } from 'twake-i18n'
import { useClient } from 'cozy-client'

import { ScribeContainer } from '@/modules/views/OnlyOffice/Scribe/ScribeContainer'
import { ScribeActionMenu } from '@/modules/views/OnlyOffice/Scribe/ScribeActionMenu'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { callScribeAI, buildMessages, deriveLoadingMessage, classifyScribeError } from '@/modules/views/OnlyOffice/Scribe/scribeAI'
import { htmlToMarkdown, normalizeHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import { transformCellMarkersForPreview } from '@/modules/views/OnlyOffice/Scribe/tableCellMarkers'
import { parseScribeResponse } from '@/modules/views/OnlyOffice/Scribe/scribeResponse'
import { ScribeResultPanel } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'
import { isScribeDevMd } from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'
import { recordProbeSample } from '@/modules/views/OnlyOffice/Scribe/scribeProbe'
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
const ScribePopover = ({ open, visible = true, selectedText, selectedHtml, enrichedMd, onReplace, onInsert, onCancel, onOpenPanel, tableAmbiguity }) => {
  const { t } = useI18n()
  const client = useClient()
  const scribe = useScribe()
  const addMessage = scribe?.addMessage
  const abortRef = useRef(null)

  const [step, setStep] = useState('menu') // 'menu' | 'loading' | 'result'
  const [result, setResult] = useState({ text: '', breadcrumb: '', error: '', canRetry: false })
  const [loadingMessage, setLoadingMessage] = useState('')
  const [lastAction, setLastAction] = useState(null)
  // Dev mode: store source HTML and intermediate MD for debug panels
  const [devData, setDevData] = useState({ html: '', md: '' })
  // Dev mode (PROBE-01): the full parsed response for the "Réponse parsée" panel
  const [parsedResponse, setParsedResponse] = useState(null)
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

  // Reset to menu state when popover opens with new intent
  useEffect(() => {
    if (open) {
      setStep('menu')
      setResult({ text: '', breadcrumb: '', error: '', canRetry: false })
      setLoadingMessage('')
      setLastAction(null)
      setDevData({ html: '', md: '' })
      setParsedResponse(null)
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

        // 4. D-13: route the raw LLM response through the shared contract layer with
        // popover surface BEFORE any display/storage. On parse failure the popover
        // fallback yields { discussion: '', fragments: [raw], fellBack: true } so the
        // normalized fragment below is byte-identical to today's raw response.
        const parsed = parseScribeResponse(text, { surface: 'popover' })

        // PROBE-01 (D-11): feed the conformance probe the parsed popover response.
        // Dev-mode only (isScribeDevMd guard) => zero production cost. `inputMd`
        // (line ~99) is the same markdown sent to the LLM, used by the probe for
        // REF/duplication comparison. Additive observation only — no behavior change.
        if (isScribeDevMd()) {
          recordProbeSample(parsed, { surface: 'popover', inputMd, ts: Date.now() })
          // Surface the structured payload in the DevPanelGrid "Réponse parsée" panel.
          setParsedResponse(parsed)
        }

        // D-08: normalize the parsed result to exactly one insertable fragment:
        //   2+ fragments -> join with \n\n; 0 fragments -> promote discussion;
        //   1 fragment -> use directly. (Re-ask on invalid parse is deferred to v3.1-05.)
        let normalizedFragment
        if (parsed.fragments.length >= 2) {
          normalizedFragment = parsed.fragments.join('\n\n')
        } else if (parsed.fragments.length === 0) {
          normalizedFragment = parsed.discussion
        } else {
          normalizedFragment = parsed.fragments[0]
        }

        // 5. D-09: the popover shows/inserts ONLY the normalized fragment; discussion is
        // NOT rendered. The cell-marker preview transform and rawResult/reinjection path
        // now operate on the normalized fragment (replacing today's raw response).
        const { displayMd, warning } = transformCellMarkersForPreview(normalizedFragment, enrichedMd)
        setRawResult(normalizedFragment)
        setCellWarning(warning)
        setResult({ text: displayMd, breadcrumb, error: '', canRetry: false })
        setStep('result')

        // 6. D-11: mirror the FULL parsed turn into shared chat history. The user
        // breadcrumb turn plus an assistant turn shaped like plan 02's extended model
        // (content == discussion, plus discussion/fragments/fellBack) — NOT the
        // normalized single-fragment blob — so the chat render-time compose helper
        // renders inline turns identically to chat-native turns (and v3.1-04 cards
        // light up for inline turns too). Reuses `parsed` from above.
        if (addMessage) {
          addMessage({ id: Date.now(), role: 'user', content: breadcrumb, timestamp: new Date() })
          addMessage({
            id: Date.now() + 1,
            role: 'assistant',
            // WR-03: mirror the insertable blob as `content` so MessageActions
            // Copy/Insert forwards real text (not "" for empty-discussion turns).
            // discussion/fragments/fellBack are preserved so ChatMessageList's
            // compose helper (which renders from discussion+fragments, not content)
            // still produces the identical bubble.
            content: normalizedFragment,
            discussion: parsed.discussion,
            fragments: parsed.fragments,
            fellBack: parsed.fellBack,
            timestamp: new Date()
          })
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return
        }
        const classified = classifyScribeError(err)
        setResult({ text: '', breadcrumb, error: classified.messageKey ? t(classified.messageKey) : '', canRetry: classified.canRetry })
        setStep('result')

        // Mirror error into shared conversation history
        if (addMessage) {
          addMessage({ id: Date.now(), role: 'user', content: breadcrumb, timestamp: new Date() })
          addMessage({ id: Date.now() + 1, role: 'error', content: classified.messageKey ? t(classified.messageKey) : 'Error', timestamp: new Date() })
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    [selectedText, selectedHtml, enrichedMd, tableAmbiguity, client, t, addMessage]
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
      transitionDuration={0}
      TransitionProps={{ onEntered: handleEntered }}
      disableAutoFocus
      disableEnforceFocus
      anchorReference="anchorPosition"
      anchorPosition={{ top: (typeof window !== 'undefined' ? window.innerHeight / 2 : 400) + dragOffset.y, left: (typeof window !== 'undefined' ? window.innerWidth / 2 : 500) + dragOffset.x }}
      transformOrigin={{ vertical: 'center', horizontal: 'center' }}
      BackdropProps={{
        style: {
          // Keep the backdrop transparent and click-through while the popover
          // is being prepared (deferred keyboard open); dim it once revealed.
          backgroundColor: visible ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
          pointerEvents: visible ? 'auto' : 'none'
        }
      }}
      PaperProps={{
        style: {
          borderRadius: 8,
          boxShadow: 'none',
          backgroundColor: 'transparent',
          overflow: 'visible',
          // Mounted but invisible during the prepare window, then revealed.
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          ...(devMode && step === 'result' ? { maxWidth: '95vw' } : {})
        }
      }}
    >
      {step === 'menu' && (
        <ScribeActionMenu ref={menuRef} onSelect={handleActionSelect} onClose={handleClose} onOpenPanel={onOpenPanel} selectedText={selectedText} />
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
          onRetry={handleRetry}
          onReplace={handleReplace}
          onInsert={handleInsert}
          onClose={handleClose}
          rawLlmResult={rawResult}
          devData={devMode ? devData : null}
          parsedResponse={devMode ? parsedResponse : null}
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
  visible: PropTypes.bool,
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
  onCancel: PropTypes.func.isRequired,
  onOpenPanel: PropTypes.func
}

export { ScribePopover }

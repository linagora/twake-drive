import PropTypes from 'prop-types'
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'

import flag from 'cozy-flags'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import Error from '@/modules/views/OnlyOffice/Error'
import OnlyOfficeAIAssistantPanel from '@/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { ScribePanel } from '@/modules/views/OnlyOffice/Scribe/ScribePanel'
import { markdownToHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import { ScribeFloatingZone } from '@/modules/views/OnlyOffice/Scribe/ScribeFloatingButton'
import { ScribePopover } from '@/modules/views/OnlyOffice/Scribe/ScribePopover'
import { FRAME_EDITOR_NAME } from '@/modules/views/OnlyOffice/config'
import { useCozyBridge } from '@/modules/views/OnlyOffice/useCozyBridge'

// Strip <p>...</p> wrapper when HTML is a single paragraph,
// so PasteHtml inserts inline without creating extra line breaks.
// Multi-paragraph, lists, headings etc. are left untouched.
const unwrapSingleParagraph = html => {
  const match = html.match(/^<p>(.*)<\/p>$/s)
  if (match && !match[1].includes('<p>')) return match[1]
  return html
}

// Delay before the inline Scribe popover is revealed on a keyboard open. The
// popover is mounted hidden (prepared) immediately and revealed after this
// delay. Tune here. Lives host-side because the plugin's background iframe
// throttles setTimeout to hundreds of ms (see handleCtrlShiftI in code.js).
const SCRIBE_REVEAL_DELAY_MS = 150

// Max time to wait for the plugin's full-document extraction reply before giving
// up. On timeout extractFullDocument resolves { md:'', error:'timeout' } so a
// dead/missing plugin yields the 'unavailable' notice instead of hanging the send.
const EXTRACT_DOCUMENT_TIMEOUT_MS = 8000

const forceIframeHeight = value => {
  const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
  if (iframe) iframe.style.height = value
}

const View = ({ id, apiUrl, docEditorConfig }) => {
  const [isError, setIsError] = useState(false)

  const { isEditorReady } = useOnlyOfficeContext()
  const isScribeEnabled = flag('drive.scribe.enabled')
  const scribe = useScribe()
  const isPanelOpen = scribe ? scribe.isPanelOpen : false
  const togglePanel = scribe ? scribe.togglePanel : undefined
  const openPanel = scribe ? scribe.openPanel : undefined
  const setCurrentSelection = scribe ? scribe.setCurrentSelection : undefined
  const setPanelActions = scribe ? scribe.setPanelActions : undefined
  const setExtractFullDocument = scribe ? scribe.setExtractFullDocument : undefined

  // cozy-bridge: listen for Scribe intents from OO plugin
  // In dev, allow all origins. In production, derive from serverUrl/instance.
  const allowedOrigins = useMemo(() => ['*'], []) // TODO: restrict in production
  // Update selection in ScribeContext whenever the plugin reports a change
  const handleSelectionChanged = useCallback(data => {
    if (setCurrentSelection) {
      setCurrentSelection(data.text || null, data.html || null, data.enrichedMd || null, data.tableSnapshots || null)
    }
    partialTableInfoRef.current = data.partialTableInfo || null
    tableSnapshotsRef.current = data.tableSnapshots || null
  }, [setCurrentSelection])

  const { pendingIntent, respond, castPanelAction } = useCozyBridge(
    allowedOrigins,
    { onTogglePanel: togglePanel, isPanelOpen, onSelectionChanged: handleSelectionChanged }
  )

  const showFloatingZone = isScribeEnabled && !isPanelOpen

  const partialTableInfoRef = useRef(null)
  const tableSnapshotsRef = useRef(null)

  // Feed selection data from pendingIntent into ScribeContext
  useEffect(() => {
    if (!setCurrentSelection || !pendingIntent?.data) return
    setCurrentSelection(
      pendingIntent.data.text || null,
      pendingIntent.data.html || null,
      pendingIntent.data.enrichedMd || null,
      pendingIntent.data.tableSnapshots || null
    )
    partialTableInfoRef.current = pendingIntent.data.partialTableInfo || null
    tableSnapshotsRef.current = pendingIntent.data.tableSnapshots || null
  }, [pendingIntent, setCurrentSelection])

  // Broadcast a message to all descendant iframes (reaches plugin inside OO editor iframe)
  const broadcastToFrames = useCallback(msg => {
    const walk = win => {
      try {
        for (let i = 0; i < win.frames.length; i++) {
          try {
            win.frames[i].postMessage(msg, '*')
            walk(win.frames[i])
          } catch (e) {
            // cross-origin frame, skip
          }
        }
      } catch (e) {
        // access denied
      }
    }
    walk(window)
  }, [])

  // Tell plugin to start/stop sending SELECTION_CHANGED based on panel state
  useEffect(() => {
    broadcastToFrames({
      type: 'cozy-bridge:selection-subscribe',
      subscribe: isPanelOpen
    })
  }, [isPanelOpen, broadcastToFrames])

  // Re-send the subscribe state when the plugin announces it's ready. If the
  // panel was already open at page load, the broadcast above fired before the
  // plugin iframe existed (message lost), so selections never synced. The
  // plugin posts 'cozy-bridge:plugin-ready' on load; we answer with the
  // current state. A ref avoids re-registering the listener on every toggle.
  const isPanelOpenRef = useRef(isPanelOpen)
  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen
  }, [isPanelOpen])
  useEffect(() => {
    const handler = e => {
      if (e.data && e.data.type === 'cozy-bridge:plugin-ready') {
        broadcastToFrames({
          type: 'cozy-bridge:selection-subscribe',
          subscribe: isPanelOpenRef.current
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [broadcastToFrames])

  // Request a full-document extraction from the OO plugin and resolve its markdown.
  // Mirrors the dev-test reqId round-trip (code.js): broadcast a dedicated
  // 'cozy-bridge:extract-document' message with a fresh reqId, register a one-shot
  // listener that resolves on the correlated 'cozy-bridge:document-extracted' reply
  // (matching BOTH type AND reqId), and resolve { md, error }. The listener is
  // removed on success AND on timeout (no leak). An ~8s timeout resolves
  // { md:'', error:'timeout' } so a dead/missing plugin yields the DEC-UI-03
  // 'unavailable' notice instead of hanging the send. Uses a DEDICATED message type
  // (NOT cozy-bridge:intent) so the payload bypasses the 1 MB validateIntent cap.
  const extractFullDocument = useCallback(
    () =>
      new Promise(resolve => {
        const reqId =
          (window.crypto &&
            window.crypto.randomUUID &&
            window.crypto.randomUUID()) ||
          String(Date.now())
        let timeoutId
        const onMsg = e => {
          const m = e.data
          if (
            !m ||
            m.type !== 'cozy-bridge:document-extracted' ||
            m.reqId !== reqId
          )
            return
          clearTimeout(timeoutId)
          window.removeEventListener('message', onMsg)
          resolve({ md: m.md || '', error: m.error || null })
        }
        window.addEventListener('message', onMsg)
        timeoutId = setTimeout(() => {
          window.removeEventListener('message', onMsg)
          resolve({ md: '', error: 'timeout' })
        }, EXTRACT_DOCUMENT_TIMEOUT_MS)
        broadcastToFrames({ type: 'cozy-bridge:extract-document', reqId })
      }),
    [broadcastToFrames]
  )

  // Send trigger-intent to plugin iframe
  const triggerScribe = useCallback(() => {
    broadcastToFrames({ type: 'cozy-bridge:trigger-intent', action: 'AI_TEXT_ASSISTANT' })
  }, [broadcastToFrames])

  const focusEditor = useCallback(() => {
    const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
    if (iframe) iframe.focus()
  }, [])

  // #1: inline Scribe reveal gating. Keyboard opens cast AI_TEXT_ASSISTANT with
  // data.deferReveal=true, so the popover mounts hidden (prepared) and is only
  // revealed when the plugin's 200ms timer fires 'cozy-bridge:reveal-scribe'.
  // Button/context-menu opens cast without the flag and reveal immediately.
  // #1: inline Scribe prepare-then-reveal. Keyboard opens cast AI_TEXT_ASSISTANT
  // with data.deferReveal=true: mount the popover hidden (prepared), then reveal
  // after SCRIBE_REVEAL_DELAY_MS so it appears in one clean step. The timer is
  // host-side (see the constant) because the plugin's background iframe throttles
  // its own timers. Re-running on each new intent clears the prior timer, so a
  // rapid re-press can't flash the still-preparing popover. Button/context-menu
  // opens cast without the flag and reveal immediately.
  const [scribeVisible, setScribeVisible] = useState(false)
  useEffect(() => {
    if (!pendingIntent) {
      setScribeVisible(false)
      return
    }
    if (!pendingIntent.data?.deferReveal) {
      setScribeVisible(true)
      return
    }
    setScribeVisible(false)
    const id = setTimeout(() => setScribeVisible(true), SCRIBE_REVEAL_DELAY_MS)
    return () => clearTimeout(id)
  }, [pendingIntent])

  // Track pendingIntent in a ref so handleReplace/handleInsert can decide
  // at call time whether to respond() to an inline popover intent or cast
  // a one-way PANEL_ACTION for a pure panel chat flow — without causing
  // MessageActions (which uses panelActions) to rebuild its handlers on
  // every selection change.
  const pendingIntentRef = useRef(pendingIntent)
  useEffect(() => {
    pendingIntentRef.current = pendingIntent
  }, [pendingIntent])

  const handleReplace = useCallback(
    text => {
      const html = unwrapSingleParagraph(markdownToHtml(text).trim())
      const data = { text, html, md: text }
      if (partialTableInfoRef.current) {
        data.partialTableInfo = partialTableInfoRef.current
      }
      if (tableSnapshotsRef.current) {
        data.tableSnapshots = tableSnapshotsRef.current
      }
      if (pendingIntentRef.current) {
        // Inline popover flow: answer the pending AI_TEXT_ASSISTANT intent.
        respond({ status: 'ok', action: 'replace', data })
      } else {
        // Pure panel chat flow: no pending intent exists, so cast a one-way
        // PANEL_ACTION directly to the plugin.
        castPanelAction({
          action: 'replace',
          text,
          html,
          md: text,
          partialTableInfo: partialTableInfoRef.current || undefined,
          tableSnapshots: tableSnapshotsRef.current || undefined
        })
      }
      setTimeout(focusEditor, 100)
    },
    [respond, castPanelAction, focusEditor]
  )

  const handleInsert = useCallback(
    text => {
      const html = unwrapSingleParagraph(markdownToHtml(text).trim())
      const data = { text, html, md: text }
      if (partialTableInfoRef.current) {
        data.partialTableInfo = partialTableInfoRef.current
      }
      if (tableSnapshotsRef.current) {
        data.tableSnapshots = tableSnapshotsRef.current
      }
      if (pendingIntentRef.current) {
        respond({ status: 'ok', action: 'insert', data })
      } else {
        castPanelAction({
          action: 'insert',
          text,
          html,
          md: text,
          partialTableInfo: partialTableInfoRef.current || undefined,
          tableSnapshots: tableSnapshotsRef.current || undefined
        })
      }
      setTimeout(focusEditor, 100)
    },
    [respond, castPanelAction, focusEditor]
  )

  // Wire respond-based handlers into ScribeContext so MessageActions can call them
  useEffect(() => {
    if (!setPanelActions) return
    setPanelActions({ replace: handleReplace, insert: handleInsert })
    return () => setPanelActions(null)
  }, [setPanelActions, handleReplace, handleInsert])

  // Inject the full-document extractor into ScribeContext so sendMessage can await
  // it at send time, mirroring the setPanelActions wiring above.
  useEffect(() => {
    if (!setExtractFullDocument) return
    setExtractFullDocument(extractFullDocument)
    return () => setExtractFullDocument(null)
  }, [setExtractFullDocument, extractFullDocument])

  const handleCancel = useCallback(() => {
    respond({ status: 'ok', action: 'cancel', data: {} })
    setTimeout(focusEditor, 100)
  }, [respond, focusEditor])

  // Close popover when panel opens while popover is active.
  // Use respond() directly instead of handleCancel to avoid focusEditor
  // stealing focus from the panel.
  useEffect(() => {
    if (isPanelOpen && pendingIntent) {
      respond({ status: 'ok', action: 'cancel', data: {} })
    }
  }, [isPanelOpen, pendingIntent, respond])

  // Focus management: return focus to editor when panel closes
  const prevPanelOpenRef = useRef(isPanelOpen)
  useEffect(() => {
    const wasOpen = prevPanelOpenRef.current
    prevPanelOpenRef.current = isPanelOpen

    if (!isPanelOpen && wasOpen) {
      setTimeout(focusEditor, 100)
    }
  }, [isPanelOpen, focusEditor])

  // Ctrl+Shift+I single-press from open popover: open panel and close popover
  useEffect(() => {
    const popoverOpen = !!pendingIntent && !isPanelOpen
    if (!popoverOpen) return

    const handler = e => {
      const isCtrlShiftI =
        (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')
      if (!isCtrlShiftI) return
      e.preventDefault()
      if (openPanel) openPanel()
      // Dismiss the popover intent WITHOUT handleCancel: handleCancel refocuses
      // the editor (setTimeout focusEditor), which would steal focus from the
      // panel input we're opening. respond() just clears the pending intent.
      respond({ status: 'ok', action: 'cancel', data: {} })
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pendingIntent, isPanelOpen, openPanel, respond])

  // Ctrl+Shift+I when focus is inside the Drive app (e.g. the side panel input)
  // never reaches the plugin's keydown listener — that one is registered on the
  // OO editor iframe document. Without a handler here the browser's default
  // devtools shortcut fires. Catch it at the Drive level, preventDefault, and
  // toggle the panel. The popover-open case is handled by the effect above, so
  // we skip it here to avoid double handling.
  useEffect(() => {
    const handler = e => {
      const isCtrlShiftI =
        (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')
      if (!isCtrlShiftI) return
      if (pendingIntent && !isPanelOpen) return
      e.preventDefault()
      if (togglePanel) togglePanel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [togglePanel, pendingIntent, isPanelOpen])

  const initEditor = useCallback(() => {
    new window.DocsAPI.DocEditor('onlyOfficeEditor', docEditorConfig)
    forceIframeHeight('0')
  }, [docEditorConfig])

  const handleError = useCallback(() => {
    const scriptNode = document.getElementById(id)
    scriptNode && scriptNode.remove()
    setIsError(true)
  }, [setIsError, id])

  useEffect(() => {
    const scriptAlreadyLoaded = document.getElementById(id)
    if (scriptAlreadyLoaded) return initEditor()

    const script = document.createElement('script')
    script.id = id
    script.src = apiUrl
    script.async = true
    script.onload = () => initEditor()
    script.onerror = () => handleError()

    document.body.appendChild(script)
  }, [id, apiUrl, initEditor, handleError])

  useEffect(() => {
    if (isEditorReady) {
      forceIframeHeight('100%')
    }
  }, [isEditorReady])

  if (isError) return <Error />

  return (
    <>
      {!isEditorReady && (
        <div className="u-flex u-flex-items-center u-flex-justify-center u-flex-grow-1">
          <Spinner size="xxlarge" />
        </div>
      )}
      <div className="u-flex u-flex-grow-1" style={{ minHeight: 0, overflow: 'hidden' }}>
        <div id="onlyOfficeEditor" style={{ flex: '1 1 auto', minWidth: 0 }} />
        <OnlyOfficeAIAssistantPanel />
        {isScribeEnabled && isPanelOpen && <ScribePanel />}
      </div>
      {isScribeEnabled && (
        <>
          <ScribeFloatingZone
            visible={showFloatingZone}
            onTriggerScribe={triggerScribe}
            onTogglePanel={togglePanel}
          />
          <ScribePopover
            open={!!pendingIntent && !isPanelOpen}
            visible={scribeVisible}
            selectedText={pendingIntent?.data?.text || ''}
            selectedHtml={pendingIntent?.data?.html || ''}
            enrichedMd={pendingIntent?.data?.enrichedMd || ''}
            tableAmbiguity={pendingIntent?.data?.tableAmbiguity || null}
            partialTableInfo={pendingIntent?.data?.partialTableInfo || null}
            onReplace={handleReplace}
            onInsert={handleInsert}
            onCancel={handleCancel}
            onOpenPanel={openPanel ? draft => {
              openPanel(draft)
              respond({ status: 'ok', action: 'cancel', data: {} })
            } : undefined}
          />
        </>
      )}
    </>
  )
}

View.propTypes = {
  id: PropTypes.string.isRequired,
  apiUrl: PropTypes.string.isRequired,
  docEditorConfig: PropTypes.object.isRequired
}

export default React.memo(View)

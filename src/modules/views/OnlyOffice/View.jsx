import PropTypes from 'prop-types'
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'

import flag from 'cozy-flags'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Error from '@/modules/views/OnlyOffice/Error'
import OnlyOfficeAIAssistantPanel from '@/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import ReadOnlyFab from '@/modules/views/OnlyOffice/ReadOnlyFab'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeContext'
import { ScribePanel } from '@/modules/views/OnlyOffice/Scribe/ScribePanel'
import { markdownToHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import { ScribeFloatingZone } from '@/modules/views/OnlyOffice/Scribe/ScribeFloatingButton'
import { ScribePopover } from '@/modules/views/OnlyOffice/Scribe/ScribePopover'
import { FRAME_EDITOR_NAME } from '@/modules/views/OnlyOffice/config'
import { isOfficeEditingEnabled } from '@/modules/views/OnlyOffice/helpers'
import { useCozyBridge } from '@/modules/views/OnlyOffice/useCozyBridge'

// Strip <p>...</p> wrapper when HTML is a single paragraph,
// so PasteHtml inserts inline without creating extra line breaks.
// Multi-paragraph, lists, headings etc. are left untouched.
const unwrapSingleParagraph = html => {
  const match = html.match(/^<p>(.*)<\/p>$/s)
  if (match && !match[1].includes('<p>')) return match[1]
  return html
}

const forceIframeHeight = value => {
  const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
  if (iframe) iframe.style.height = value
}

const View = ({ id, apiUrl, docEditorConfig }) => {
  const [isError, setIsError] = useState(false)

  const { isEditorReady, isReadOnly, isTrashed } = useOnlyOfficeContext()
  const { isMobile, isDesktop } = useBreakpoints()
  const isScribeEnabled = flag('drive.scribe.enabled')
  const scribe = useScribe()
  const isPanelOpen = scribe ? scribe.isPanelOpen : false
  const togglePanel = scribe ? scribe.togglePanel : undefined
  const openPanel = scribe ? scribe.openPanel : undefined
  const setCurrentSelection = scribe ? scribe.setCurrentSelection : undefined
  const setPanelActions = scribe ? scribe.setPanelActions : undefined

  // cozy-bridge: listen for Scribe intents from OO plugin
  // In dev, allow all origins. In production, derive from serverUrl/instance.
  const allowedOrigins = useMemo(() => ['*'], []) // TODO: restrict in production
  // Update selection in ScribeContext whenever the plugin reports a change
  const handleSelectionChanged = useCallback(data => {
    if (setCurrentSelection) {
      setCurrentSelection(data.text || null, data.html || null)
    }
  }, [setCurrentSelection])

  const { pendingIntent, respond } = useCozyBridge(
    allowedOrigins,
    { onTogglePanel: togglePanel, isPanelOpen, onSelectionChanged: handleSelectionChanged }
  )

  const showFloatingZone = isScribeEnabled && !isPanelOpen

  const partialTableInfoRef = useRef(null)

  // Feed selection data from pendingIntent into ScribeContext
  useEffect(() => {
    if (!setCurrentSelection || !pendingIntent?.data) return
    setCurrentSelection(
      pendingIntent.data.text || null,
      pendingIntent.data.html || null
    )
    partialTableInfoRef.current = pendingIntent.data.partialTableInfo || null
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

  // Send trigger-intent to plugin iframe
  const triggerScribe = useCallback(() => {
    broadcastToFrames({ type: 'cozy-bridge:trigger-intent', action: 'AI_TEXT_ASSISTANT' })
  }, [broadcastToFrames])

  const focusEditor = useCallback(() => {
    const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
    if (iframe) iframe.focus()
  }, [])

  const handleReplace = useCallback(
    text => {
      const html = unwrapSingleParagraph(markdownToHtml(text).trim())
      const data = { text, html, md: text }
      if (partialTableInfoRef.current) {
        data.partialTableInfo = partialTableInfoRef.current
      }
      respond({ status: 'ok', action: 'replace', data })
      setTimeout(focusEditor, 100)
    },
    [respond, focusEditor]
  )

  const handleInsert = useCallback(
    text => {
      const html = unwrapSingleParagraph(markdownToHtml(text).trim())
      const data = { text, html, md: text }
      if (partialTableInfoRef.current) {
        data.partialTableInfo = partialTableInfoRef.current
      }
      respond({ status: 'ok', action: 'insert', data })
      setTimeout(focusEditor, 100)
    },
    [respond, focusEditor]
  )

  // Wire respond-based handlers into ScribeContext so MessageActions can call them
  useEffect(() => {
    if (!setPanelActions) return
    setPanelActions({ replace: handleReplace, insert: handleInsert })
    return () => setPanelActions(null)
  }, [setPanelActions, handleReplace, handleInsert])

  const handleCancel = useCallback(() => {
    respond({ status: 'ok', action: 'cancel', data: {} })
    setTimeout(focusEditor, 100)
  }, [respond, focusEditor])

  // Use a ref for handleCancel so the keydown listener never goes stale
  const handleCancelRef = useRef(handleCancel)
  useEffect(() => {
    handleCancelRef.current = handleCancel
  }, [handleCancel])

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
      handleCancelRef.current()
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pendingIntent, isPanelOpen, openPanel])

  // Ctrl+Shift+I when panel is open is handled by useCozyBridge:
  // the plugin casts AI_TEXT_ASSISTANT or TOGGLE_SCRIBE_PANEL, and the bridge
  // handler closes the panel. No document keydown listener needed here
  // since OO keeps focus in its cross-origin iframe.

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

  const showReadOnlyFab =
    isMobile &&
    isEditorReady &&
    !isReadOnly &&
    !isTrashed &&
    isOfficeEditingEnabled(isDesktop)

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
            selectedText={pendingIntent?.data?.text || ''}
            selectedHtml={pendingIntent?.data?.html || ''}
            enrichedMd={pendingIntent?.data?.enrichedMd || ''}
            tableAmbiguity={pendingIntent?.data?.tableAmbiguity || null}
            partialTableInfo={pendingIntent?.data?.partialTableInfo || null}
            onReplace={handleReplace}
            onInsert={handleInsert}
            onCancel={handleCancel}
            onOpenPanel={openPanel ? () => {
              openPanel()
              respond({ status: 'ok', action: 'cancel', data: {} })
            } : undefined}
          />
        </>
      )}
      {showReadOnlyFab && <ReadOnlyFab />}
    </>
  )
}

View.propTypes = {
  id: PropTypes.string.isRequired,
  apiUrl: PropTypes.string.isRequired,
  docEditorConfig: PropTypes.object.isRequired
}

export default React.memo(View)

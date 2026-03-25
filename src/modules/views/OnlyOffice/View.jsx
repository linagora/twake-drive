import PropTypes from 'prop-types'
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'

import flag from 'cozy-flags'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Error from '@/modules/views/OnlyOffice/Error'
import OnlyOfficeAIAssistantPanel from '@/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import ReadOnlyFab from '@/modules/views/OnlyOffice/ReadOnlyFab'
import { markdownToHtml } from '@/modules/views/OnlyOffice/Scribe/scribeConversion'
import { ScribeFloatingButton } from '@/modules/views/OnlyOffice/Scribe/ScribeFloatingButton'
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

  // cozy-bridge: listen for Scribe intents from OO plugin
  // In dev, allow all origins. In production, derive from serverUrl/instance.
  const allowedOrigins = useMemo(() => ['*'], []) // TODO: restrict in production
  const { pendingIntent, showScribeButton, respond } =
    useCozyBridge(allowedOrigins)

  // Store partialTableInfo in a ref (doesn't need to trigger re-renders)
  const partialTableInfoRef = useRef(null)
  useEffect(() => {
    if (pendingIntent?.data?.partialTableInfo) {
      partialTableInfoRef.current = pendingIntent.data.partialTableInfo
    } else {
      partialTableInfoRef.current = null
    }
  }, [pendingIntent])

  // Send trigger-intent to plugin iframe (nested inside OO editor iframe).
  // We broadcast to all descendant iframes so the message reaches the plugin.
  const triggerScribe = useCallback(() => {
    const msg = { type: 'cozy-bridge:trigger-intent', action: 'AI_TEXT_ASSISTANT' }
    const broadcastToFrames = win => {
      try {
        for (let i = 0; i < win.frames.length; i++) {
          try {
            win.frames[i].postMessage(msg, '*')
            broadcastToFrames(win.frames[i])
          } catch (e) {
            // cross-origin frame, skip
          }
        }
      } catch (e) {
        // access denied
      }
    }
    broadcastToFrames(window)
  }, [])

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

  const handleCancel = useCallback(() => {
    respond({ status: 'ok', action: 'cancel', data: {} })
    setTimeout(focusEditor, 100)
  }, [respond, focusEditor])

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
      <div className="u-flex u-flex-grow-1">
        <div id="onlyOfficeEditor" />
        <OnlyOfficeAIAssistantPanel />
      </div>
      {isScribeEnabled && (
        <>
          <ScribeFloatingButton
            visible={!!showScribeButton && !pendingIntent}
            onClick={triggerScribe}
          />
          <ScribePopover
            open={!!pendingIntent}
            selectedText={pendingIntent?.data?.text || ''}
            selectedHtml={pendingIntent?.data?.html || ''}
            enrichedMd={pendingIntent?.data?.enrichedMd || ''}
            tableAmbiguity={pendingIntent?.data?.tableAmbiguity || null}
            partialTableInfo={pendingIntent?.data?.partialTableInfo || null}
            onReplace={handleReplace}
            onInsert={handleInsert}
            onCancel={handleCancel}
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

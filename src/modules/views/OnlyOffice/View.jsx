import PropTypes from 'prop-types'
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'

import Spinner from 'cozy-ui/transpiled/react/Spinner'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Error from '@/modules/views/OnlyOffice/Error'
import OnlyOfficeAIAssistantPanel from '@/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import ReadOnlyFab from '@/modules/views/OnlyOffice/ReadOnlyFab'
import { ScribeFloatingButton } from '@/modules/views/OnlyOffice/Scribe/ScribeFloatingButton'
import { ScribePopover } from '@/modules/views/OnlyOffice/Scribe/ScribePopover'
import { FRAME_EDITOR_NAME } from '@/modules/views/OnlyOffice/config'
import { isOfficeEditingEnabled } from '@/modules/views/OnlyOffice/helpers'
import { useCozyBridge } from '@/modules/views/OnlyOffice/useCozyBridge'

const forceIframeHeight = value => {
  const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
  if (iframe) iframe.style.height = value
}

const View = ({ id, apiUrl, docEditorConfig }) => {
  const [isError, setIsError] = useState(false)

  const { isEditorReady, isReadOnly, isTrashed } = useOnlyOfficeContext()
  const { isMobile, isDesktop } = useBreakpoints()

  // cozy-bridge: listen for Scribe intents from OO plugin
  // In dev, allow all origins. In production, derive from serverUrl/instance.
  const allowedOrigins = useMemo(() => ['*'], []) // TODO: restrict in production
  const { pendingIntent, selectionState, respond } = useCozyBridge(allowedOrigins)

  const floatingButtonRef = useRef(null)

  // Convert iframe-relative coordinates to host-page coordinates
  const hostPosition = useMemo(() => {
    if (!selectionState) return null

    const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
    if (!iframe) return null

    const rect = iframe.getBoundingClientRect()
    return {
      top: rect.top + selectionState.top,
      left: rect.left + selectionState.left
    }
  }, [selectionState])

  // Send trigger-intent to plugin iframe so it casts the intent through normal channel.
  // The plugin iframe is a child of the OO editor iframe, so we broadcast to the
  // editor iframe AND all its child frames to reach the plugin regardless of nesting.
  const triggerScribe = useCallback(() => {
    const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
    if (!iframe || !iframe.contentWindow) return
    const msg = {
      type: 'cozy-bridge:trigger-intent',
      version: 1,
      action: 'AI_TEXT_EDIT'
    }
    // Post to editor iframe itself
    iframe.contentWindow.postMessage(msg, '*')
    // Post to all child frames (plugin iframes are nested inside OO editor)
    try {
      const frames = iframe.contentWindow.frames
      for (let i = 0; i < frames.length; i++) {
        try { frames[i].postMessage(msg, '*') } catch (e) { /* cross-origin child */ }
      }
    } catch (e) {
      // Editor iframe may be cross-origin in some setups
    }
  }, [])

  const handleReplace = useCallback(
    text => {
      respond({ status: 'ok', action: 'replace', data: { text } })
    },
    [respond]
  )

  const handleInsert = useCallback(
    text => {
      respond({ status: 'ok', action: 'insert', data: { text } })
    },
    [respond]
  )

  const handleCancel = useCallback(() => {
    respond({ status: 'ok', action: 'cancel', data: {} })
  }, [respond])

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
      <ScribeFloatingButton
        visible={!!selectionState && !pendingIntent}
        position={hostPosition}
        onClick={triggerScribe}
        buttonRef={floatingButtonRef}
      />
      <ScribePopover
        open={!!pendingIntent}
        selectedText={pendingIntent?.data?.text || ''}
        onReplace={handleReplace}
        onInsert={handleInsert}
        onCancel={handleCancel}
        anchorEl={floatingButtonRef.current}
      />
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

import PropTypes from 'prop-types'
import React, { useEffect, useCallback, useState } from 'react'

import Spinner from 'cozy-ui/transpiled/react/Spinner'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Error from '@/modules/views/OnlyOffice/Error'
import OnlyOfficeAIAssistantPanel from '@/modules/views/OnlyOffice/OnlyOfficeAIAssistantPanel'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import ReadOnlyFab from '@/modules/views/OnlyOffice/ReadOnlyFab'
import { FRAME_EDITOR_NAME } from '@/modules/views/OnlyOffice/config'
import { isOfficeEditingEnabled } from '@/modules/views/OnlyOffice/helpers'

const forceIframeHeight = value => {
  const iframe = document.getElementsByName(FRAME_EDITOR_NAME)[0]
  if (iframe) iframe.style.height = value
}

const View = ({ id, apiUrl, docEditorConfig }) => {
  const [isError, setIsError] = useState(false)

  const { isEditorReady, isReadOnly, isTrashed } = useOnlyOfficeContext()
  const { isMobile, isDesktop } = useBreakpoints()

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

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import flag from 'cozy-flags'

import logger from '@/lib/logger'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  INSERT_SLIDE,
  INSERT_TABLE,
  makeTableMarkdown,
  normalizeSlide,
  normalizeTable
} from '@/modules/views/OnlyOffice/Scribe/capabilities'
import {
  readPanelOpen,
  writePanelOpen
} from '@/modules/views/OnlyOffice/Scribe/panelState'
import { FRAME_EDITOR_NAME } from '@/modules/views/OnlyOffice/config'

const ScribeContext = createContext({ isAvailable: false, isOpen: false })

export const useScribe = () => useContext(ScribeContext)

const EDITOR_FOCUS_DELAY = 100

const focusEditorFrame = () => {
  document.getElementsByName(FRAME_EDITOR_NAME)[0]?.focus()
}

const findFrameBox = () =>
  document.getElementsByName(FRAME_EDITOR_NAME)[0]?.getBoundingClientRect() ??
  null

// The plugin gives the geometry in pixels of the editor frame
const makeGeometry = ({ selection, viewer }) => {
  const frame = findFrameBox()
  return frame === null ? null : { selection, viewer, frame }
}

/**
 * Talks to the scribe plugin of the Document Server (plugins/onlyoffice-scribe)
 * through postMessage. Without the plugin, there is no scribe.
 */
export const ScribeProvider = ({ serverUrl, documentType, children }) => {
  const serverOrigin = new URL(serverUrl).origin
  const { isPublic, isReadOnly } = useOnlyOfficeContext()
  const [plugin, setPlugin] = useState(null)
  const [text, setText] = useState(null)
  const [geometry, setGeometry] = useState(null)
  const [source, setSource] = useState(null)
  const [isRestorePending, setIsRestorePending] = useState(readPanelOpen)
  // Where no button could open the panel, it is not opened again either
  const canRestore =
    isRestorePending &&
    !isPublic &&
    !isReadOnly &&
    Boolean(flag('cozy.assistant.enabled'))

  useEffect(() => {
    const handleMessage = event => {
      if (event.origin !== serverOrigin) return

      const { type, content, target, canReplace } = event.data ?? {}
      const text = { content, target, canReplace }
      if (type === 'twake-scribe:ready') setPlugin(event.source)
      if (type === 'twake-scribe:content') setText(text)
      if (type === 'twake-scribe:selection') {
        setText(current => (current === null ? null : text))
      }
      if (type === 'twake-scribe:geometry') {
        setGeometry(makeGeometry(event.data))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [serverOrigin])

  useEffect(() => {
    const handleResize = () => {
      setGeometry(current => current && makeGeometry(current))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // The panel opens once the plugin answers with twake-scribe:content
  const open = useCallback(
    ({ source = null } = {}) => {
      setIsRestorePending(false)
      writePanelOpen(true)
      setSource(source)
      plugin.postMessage({ type: 'twake-scribe:getContent' }, serverOrigin)
    },
    [plugin, serverOrigin]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (plugin !== null && canRestore) open({ source: 'restored' })
  }, [plugin, canRestore, open])

  const value = useMemo(() => {
    // The plugin has no message for a table: it goes in as a Markdown
    // answer, whose tables the plugin writes as tables of the document
    const makeCapabilityMessage = ({ capability, params }) => {
      if (capability === INSERT_SLIDE && documentType === 'slide') {
        const slide = normalizeSlide(params)
        return slide === null
          ? null
          : { type: 'twake-scribe:insertSlide', ...slide }
      }
      if (capability === INSERT_TABLE && documentType === 'word') {
        const table = normalizeTable(params)
        return table === null
          ? null
          : {
              type: 'twake-scribe:applyAnswer',
              answerAction: 'insert',
              text: makeTableMarkdown(table),
              format: 'markdown'
            }
      }
      return null
    }

    const callCapability = result => {
      const message = makeCapabilityMessage(result)
      if (message === null) {
        logger.warn(
          `Scribe: capability call ignored: ${result.capability}`,
          result.params
        )
        return
      }
      plugin.postMessage(message, serverOrigin)
    }

    return {
      isAvailable: plugin !== null,
      isOpen: text !== null,
      content: text?.content,
      target: text?.target,
      canReplace: text?.canReplace,
      documentType,
      geometry,
      source,
      open,
      // The plugin reads every selection while the panel is open, which
      // empties the redo of the editor: it stops once the panel is closed
      close: () => {
        setIsRestorePending(false)
        writePanelOpen(false)
        plugin?.postMessage({ type: 'twake-scribe:close' }, serverOrigin)
        setText(null)
        // The focus was in the assistant, which goes with the panel
        setTimeout(focusEditorFrame, EDITOR_FOCUS_DELAY)
      },
      applyResult: result => {
        if (result?.capability !== undefined) {
          callCapability(result)
          return
        }
        plugin.postMessage(
          { ...result, type: 'twake-scribe:applyAnswer' },
          serverOrigin
        )
      }
    }
  }, [plugin, text, geometry, source, serverOrigin, documentType, open])

  return (
    <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>
  )
}

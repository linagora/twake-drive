import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import { useI18n } from 'twake-i18n'

import logger from '@/lib/logger'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { isScribeAllowed } from '@/modules/views/OnlyOffice/Scribe/availability'
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

const ScribeContext = createContext({
  isAvailable: false,
  isOpen: false
})
// Apart from the rest: the plugin sends a geometry up to 8 times a second,
// which only the buttons follow
const ScribeGeometryContext = createContext(null)

export const useScribe = () => useContext(ScribeContext)

export const useScribeGeometry = () => useContext(ScribeGeometryContext)

const EDITOR_FOCUS_DELAY = 100

const focusEditorFrame = () => {
  document.getElementsByName(FRAME_EDITOR_NAME)[0]?.focus()
}

// The plugin is a frame of the frame of the editor: another frame of the
// Document Server's origin, as a plugin of another editor, cannot take its
// place
const isEditorPlugin = source =>
  Boolean(source) &&
  source.parent ===
    document.getElementsByName(FRAME_EDITOR_NAME)[0]?.contentWindow

const findFrameBox = () =>
  document.getElementsByName(FRAME_EDITOR_NAME)[0]?.getBoundingClientRect() ??
  null

// The plugin gives the geometry in pixels of the editor frame
const makeGeometry = ({ selection, viewer }) => {
  const frame = findFrameBox()
  return frame === null ? null : { selection, viewer, frame }
}

// The plugin has no message for a table: it goes in as a Markdown answer,
// whose tables the plugin writes as tables of the document
const makeCapabilityMessage = ({ capability, params }, documentType) => {
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

/**
 * Talks to the scribe plugin of the Document Server (plugins/onlyoffice-scribe)
 * through postMessage. Without the plugin, there is no scribe.
 *
 * The scribe shows in a panel beside the editor.
 */
export const ScribeProvider = ({ serverUrl, documentType, children }) => {
  const { t } = useI18n()
  const serverOrigin = new URL(serverUrl).origin
  const isAllowed = isScribeAllowed(useOnlyOfficeContext())
  const [plugin, setPlugin] = useState(null)
  const [text, setText] = useState(null)
  const [geometry, setGeometry] = useState(null)
  const [source, setSource] = useState(null)
  // The cells of the selection the last answer had no cell for
  const [skippedCells, setSkippedCells] = useState(null)
  const [isRestorePending, setIsRestorePending] = useState(readPanelOpen)
  // Set at once, unlike the state: the plugin sends its geometry right after
  // it is ready, maybe before a render
  const pluginWindow = useRef(null)
  const geometryRef = useRef(null)
  // The plugin tells what it wrote: not for an answer of a panel closed since
  const isAnswerSent = useRef(false)
  // Where Drive shows no button for the scribe, the editor shows no entry
  // for it, and the panel is not opened again either
  const canRestore = isRestorePending && isAllowed
  const isOpen = text !== null

  useEffect(() => {
    const handleMessage = event => {
      if (event.origin !== serverOrigin) return

      const { type, content, target, canReplace } = event.data ?? {}
      const text = { content, target, canReplace }
      if (type === 'twake-scribe:ready' && isEditorPlugin(event.source)) {
        pluginWindow.current = event.source
        setPlugin(event.source)
      }
      // Another plugin of the Document Server has its origin too
      if (event.source !== pluginWindow.current) return
      if (type === 'twake-scribe:content') setText(text)
      if (type === 'twake-scribe:selection') {
        setText(current => (current === null ? null : text))
      }
      if (type === 'twake-scribe:geometry') {
        geometryRef.current = makeGeometry(event.data)
        setGeometry(geometryRef.current)
      }
      if (type === 'twake-scribe:applied' && isAnswerSent.current) {
        isAnswerSent.current = false
        const count = event.data.skippedCells
        if (Number.isInteger(count) && count > 0) setSkippedCells(count)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [serverOrigin])

  useEffect(() => {
    const handleResize = () => {
      geometryRef.current =
        geometryRef.current && makeGeometry(geometryRef.current)
      setGeometry(geometryRef.current)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // The panel opens once the plugin answers with twake-scribe:content. Open,
  // it gets the text selected now.
  const open = useCallback(
    ({ source = null } = {}) => {
      setIsRestorePending(false)
      writePanelOpen(true)
      setSource(source)
      pluginWindow.current?.postMessage(
        { type: 'twake-scribe:getContent' },
        serverOrigin
      )
    },
    [serverOrigin]
  )

  // The plugin reads every selection while the panel is open, which empties
  // the redo of the editor: it stops once the panel is closed
  const close = useCallback(() => {
    setIsRestorePending(false)
    writePanelOpen(false)
    setSkippedCells(null)
    isAnswerSent.current = false
    pluginWindow.current?.postMessage(
      { type: 'twake-scribe:close' },
      serverOrigin
    )
    setText(null)
    // The focus was in the assistant, which goes with the panel
    setTimeout(focusEditorFrame, EDITOR_FOCUS_DELAY)
  }, [serverOrigin])

  const applyResult = useCallback(
    result => {
      // A newer assistant may send results this version does not know
      const isAnswer =
        typeof result?.answerAction === 'string' &&
        typeof result?.text === 'string'
      if (result?.capability === undefined && !isAnswer) {
        logger.warn('Scribe: result ignored', result)
        return
      }
      const message =
        result?.capability !== undefined
          ? makeCapabilityMessage(result, documentType)
          : { ...result, type: 'twake-scribe:applyAnswer' }
      if (message === null) {
        logger.warn(
          `Scribe: capability call ignored: ${result.capability}`,
          result.params
        )
        return
      }
      setSkippedCells(null)
      isAnswerSent.current = true
      pluginWindow.current?.postMessage(message, serverOrigin)
    },
    [serverOrigin, documentType]
  )

  const dismissSkippedCells = useCallback(() => setSkippedCells(null), [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (plugin !== null && canRestore) open({ source: 'restored' })
  }, [plugin, canRestore, open])

  useEffect(() => {
    if (plugin !== null && isAllowed) {
      // The editor shows the labels as they are given, in a single language
      plugin.postMessage(
        {
          type: 'twake-scribe:showToolbar',
          labels: {
            tab: t('OnlyOffice.scribe.toolbar.tab'),
            scribeHint: t('OnlyOffice.scribe.toolbar.scribeHint'),
            panel: t('OnlyOffice.scribe.panel'),
            panelHint: t('OnlyOffice.scribe.toolbar.panelHint')
          }
        },
        serverOrigin
      )
    }
  }, [plugin, isAllowed, serverOrigin, t])

  useEffect(() => {
    if (plugin === null || !isAllowed) return

    const handleOpenRequest = event => {
      if (event.origin !== serverOrigin || event.source !== plugin) return
      const { type, source } = event.data ?? {}
      if (type !== 'twake-scribe:open' || source !== 'toolbar-panel') return

      if (isOpen) close()
      else open({ source: 'editor-toolbar' })
    }

    window.addEventListener('message', handleOpenRequest)
    return () => window.removeEventListener('message', handleOpenRequest)
  }, [plugin, isAllowed, isOpen, serverOrigin, open, close])

  const value = useMemo(
    () => ({
      isAvailable: plugin !== null,
      isOpen,
      content: text?.content,
      target: text?.target,
      canReplace: text?.canReplace,
      documentType,
      source,
      skippedCells,
      open,
      close,
      applyResult,
      dismissSkippedCells
    }),
    [
      plugin,
      isOpen,
      text,
      documentType,
      source,
      skippedCells,
      open,
      close,
      applyResult,
      dismissSkippedCells
    ]
  )

  return (
    <ScribeContext.Provider value={value}>
      <ScribeGeometryContext.Provider value={geometry}>
        {children}
      </ScribeGeometryContext.Provider>
    </ScribeContext.Provider>
  )
}

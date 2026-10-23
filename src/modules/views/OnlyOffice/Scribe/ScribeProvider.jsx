import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import flag from 'cozy-flags'

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
import { cutDocument } from '@/modules/views/OnlyOffice/Scribe/documentBudget'
import {
  readPanelOpen,
  writePanelOpen
} from '@/modules/views/OnlyOffice/Scribe/panelState'
import { FRAME_EDITOR_NAME } from '@/modules/views/OnlyOffice/config'

const ScribeContext = createContext({
  isAvailable: false,
  isOpen: false,
  isPopoverOpen: false
})
// Apart from the rest: the plugin sends a geometry up to 8 times a second,
// which only the buttons and the popover follow
const ScribeGeometryContext = createContext(null)

export const useScribe = () => useContext(ScribeContext)

export const useScribeGeometry = () => useContext(ScribeGeometryContext)

const EDITOR_FOCUS_DELAY = 100
// The plugin answers in a few hundred milliseconds, and not at all while the
// editor loads or saves
const CONTENT_WAIT = 3000
// The assistant waits as long for the whole document, then goes on without
const DOCUMENT_WAIT = 8000
const NO_SURFACE = { panel: false, popover: false }
const NO_DOCUMENT = { document: null, documentTruncated: false }

const clearTimer = timer => {
  clearTimeout(timer.current)
  timer.current = null
}

const focusEditorFrame = () => {
  document.getElementsByName(FRAME_EDITOR_NAME)[0]?.focus()
}

// The user may have clicked elsewhere in Drive meanwhile
const focusEditorFrameIfLost = () => {
  if (document.activeElement === document.body) focusEditorFrame()
}

const findFrameBox = () =>
  document.getElementsByName(FRAME_EDITOR_NAME)[0]?.getBoundingClientRect() ??
  null

// The plugin gives the geometry in pixels of the editor frame
const makeGeometry = ({ selection, viewer }) => {
  const frame = findFrameBox()
  return frame === null ? null : { selection, viewer, frame }
}

const makeDocumentData = content => {
  if (typeof content !== 'string') return NO_DOCUMENT
  const { document, isTruncated } = cutDocument(
    content,
    flag('drive.scribe.contextBudget')
  )
  return { document, documentTruncated: isTruncated }
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
 * The scribe shows in a panel beside the editor, in a popover on the
 * selection, or in both at once.
 */
export const ScribeProvider = ({ serverUrl, documentType, children }) => {
  const serverOrigin = new URL(serverUrl).origin
  const isAllowed = isScribeAllowed(useOnlyOfficeContext())
  const [plugin, setPlugin] = useState(null)
  const [text, setText] = useState(null)
  const [surfaces, setSurfaces] = useState(NO_SURFACE)
  const [geometry, setGeometry] = useState(null)
  const [source, setSource] = useState(null)
  const [popoverSource, setPopoverSource] = useState(null)
  const [handOver, setHandOver] = useState(null)
  const [documentData, setDocumentData] = useState(null)
  // { surface, count }: the cells of the selection the last answer of the
  // surface had no cell for
  const [skippedCells, setSkippedCells] = useState(null)
  const [isRestorePending, setIsRestorePending] = useState(readPanelOpen)
  // Set at once, unlike the state: the plugin sends its geometry right after
  // it is ready, maybe before a render
  const pluginWindow = useRef(null)
  // Read by the listener and the callbacks between two renders
  const surfacesRef = useRef(NO_SURFACE)
  const geometryRef = useRef(null)
  const popoverContent = useRef(null)
  // The surfaces whose text is asked for: the answer of the plugin opens them
  const pendingSurfaces = useRef(new Set())
  const closeTimer = useRef(null)
  // Set while the whole document is awaited: an answer after the wait is
  // dropped
  const documentTimer = useRef(null)
  // The plugin tells what it wrote without telling for which surface
  const writingSurface = useRef(null)
  // Where Drive shows no button for the scribe, the editor shows no entry
  // for it, and the panel is not opened again either
  const canRestore = isRestorePending && isAllowed
  const isOpen = surfaces.panel
  const isPopoverOpen = surfaces.popover

  const showSurfaces = useCallback(changes => {
    surfacesRef.current = { ...surfacesRef.current, ...changes }
    setSurfaces(surfacesRef.current)
  }, [])

  const stopReading = useCallback(() => {
    pluginWindow.current?.postMessage(
      { type: 'twake-scribe:close' },
      serverOrigin
    )
    setText(null)
  }, [serverOrigin])

  // The plugin reads every selection while a surface is open, which empties
  // the redo of the editor: it stops once none is open nor awaited. The
  // close would make it drop the text being read.
  const hideSurface = useCallback(
    name => {
      showSurfaces({ [name]: false })
      pendingSurfaces.current.delete(name)
      setSkippedCells(current => (current?.surface === name ? null : current))
      if (name === 'panel') setHandOver(null)
      if (surfacesRef.current.panel || surfacesRef.current.popover) return
      clearTimer(documentTimer)
      setDocumentData(null)
      if (pendingSurfaces.current.size === 0) {
        stopReading()
        return
      }

      clearTimer(closeTimer)
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null
        pendingSurfaces.current.clear()
        if (!surfacesRef.current.panel && !surfacesRef.current.popover) {
          stopReading()
        }
      }, CONTENT_WAIT)
    },
    [showSurfaces, stopReading]
  )

  useEffect(() => {
    const timers = [closeTimer, documentTimer]
    return () => timers.forEach(clearTimer)
  }, [])

  useEffect(() => {
    const handleMessage = event => {
      if (event.origin !== serverOrigin) return

      const { type, content, target, canReplace } = event.data ?? {}
      const text = { content, target, canReplace }
      if (type === 'twake-scribe:ready') {
        pluginWindow.current = event.source
        setPlugin(event.source)
      }
      // Another plugin of the Document Server has its origin too
      if (event.source !== pluginWindow.current) return
      if (type === 'twake-scribe:content') {
        clearTimer(closeTimer)
        const opened =
          pendingSurfaces.current.size > 0
            ? [...pendingSurfaces.current]
            : ['panel']
        pendingSurfaces.current.clear()
        if (opened.includes('popover')) popoverContent.current = content
        setText(text)
        showSurfaces(Object.fromEntries(opened.map(name => [name, true])))
      }
      if (type === 'twake-scribe:selection') {
        // Drive cannot see a click in the editor: another text selected is
        // what tells the popover to go
        if (surfacesRef.current.popover && content !== popoverContent.current) {
          hideSurface('popover')
        }
        setText(current => (current === null ? null : text))
      }
      if (type === 'twake-scribe:geometry') {
        geometryRef.current = makeGeometry(event.data)
        setGeometry(geometryRef.current)
      }
      if (type === 'twake-scribe:document' && documentTimer.current !== null) {
        clearTimer(documentTimer)
        setDocumentData(makeDocumentData(content))
      }
      if (type === 'twake-scribe:applied') {
        const count = event.data.skippedCells
        const surface = writingSurface.current
        if (
          Number.isInteger(count) &&
          count > 0 &&
          surfacesRef.current[surface]
        ) {
          setSkippedCells({ surface, count })
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [serverOrigin, showSurfaces, hideSurface])

  useEffect(() => {
    const handleResize = () => {
      geometryRef.current =
        geometryRef.current && makeGeometry(geometryRef.current)
      setGeometry(geometryRef.current)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const requestContent = useCallback(
    surface => {
      // The plugin answers the last request only: the ones given up on go
      if (closeTimer.current !== null) {
        clearTimer(closeTimer)
        pendingSurfaces.current.clear()
      }
      pendingSurfaces.current.add(surface)
      pluginWindow.current?.postMessage(
        { type: 'twake-scribe:getContent' },
        serverOrigin
      )
    },
    [serverOrigin]
  )

  // A request while one is awaited waits for the same answer, which goes to
  // the panel and the popover alike
  const requestDocument = useCallback(() => {
    if (documentTimer.current !== null) return
    // The data lose the previous document: the same one given again is new
    // data for the assistant
    setDocumentData(null)
    documentTimer.current = setTimeout(() => {
      documentTimer.current = null
      setDocumentData(NO_DOCUMENT)
    }, DOCUMENT_WAIT)
    pluginWindow.current?.postMessage(
      { type: 'twake-scribe:getDocument' },
      serverOrigin
    )
  }, [serverOrigin])

  // The panel opens once the plugin answers with twake-scribe:content
  const open = useCallback(
    ({ source = null } = {}) => {
      setIsRestorePending(false)
      writePanelOpen(true)
      setSource(source)
      requestContent('panel')
    },
    [requestContent]
  )

  const close = useCallback(() => {
    setIsRestorePending(false)
    writePanelOpen(false)
    hideSurface('panel')
    // The focus was in the assistant, which goes with the panel
    setTimeout(focusEditorFrame, EDITOR_FOCUS_DELAY)
  }, [hideSurface])

  // The popover is placed on the selection, whose place the plugin gives in
  // a text document only: elsewhere the scribe opens in the panel
  const openPopover = useCallback(
    ({ source = null } = {}) => {
      // Already on this selection: another text selected would have closed it
      if (surfacesRef.current.popover) return
      if (!geometryRef.current?.selection) {
        open({ source })
        return
      }
      setPopoverSource(source)
      requestContent('popover')
    },
    [open, requestContent]
  )

  const closePopover = useCallback(() => {
    hideSurface('popover')
    setTimeout(focusEditorFrameIfLost, EDITOR_FOCUS_DELAY)
  }, [hideSurface])

  // The assistant reads the draft and the conversation at its opening only:
  // the panel opens a new intent with them, even when it is open
  const handOverToPanel = useCallback(
    ({ draft = null, conversation = null }) => {
      // The popover goes, and the panel gets a new intent
      setSkippedCells(null)
      setHandOver(current => ({
        draft,
        conversation,
        id: (current?.id ?? 0) + 1
      }))
      if (!surfacesRef.current.popover) {
        open({ source: 'popover' })
        return
      }
      setIsRestorePending(false)
      writePanelOpen(true)
      setSource('popover')
      // Another text selected would have closed the popover: its text is
      // still the selection, and the plugin goes on reading it
      showSurfaces({ panel: true, popover: false })
    },
    [open, showSurfaces]
  )

  // `surface`: the panel or the popover whose assistant gave the result
  const applyResult = useCallback(
    (result, surface) => {
      if (result?.request === 'panel') {
        handOverToPanel(result)
        return
      }
      if (result?.request === 'document') {
        requestDocument()
        return
      }
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
      writingSurface.current = surface
      setSkippedCells(null)
      pluginWindow.current?.postMessage(message, serverOrigin)
    },
    [serverOrigin, documentType, handOverToPanel, requestDocument]
  )

  const dismissSkippedCells = useCallback(() => setSkippedCells(null), [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (plugin !== null && canRestore) open({ source: 'restored' })
  }, [plugin, canRestore, open])

  useEffect(() => {
    if (plugin !== null && isAllowed) {
      plugin.postMessage({ type: 'twake-scribe:showToolbar' }, serverOrigin)
    }
  }, [plugin, isAllowed, serverOrigin])

  useEffect(() => {
    if (plugin === null || !isAllowed) return

    const handleOpenRequest = event => {
      if (event.origin !== serverOrigin || event.source !== plugin) return
      const { type, source } = event.data ?? {}
      if (type !== 'twake-scribe:open') return

      if (source === 'toolbar-inline') openPopover({ source: 'editor-toolbar' })
      if (source === 'toolbar-panel') {
        if (isOpen) close()
        else open({ source: 'editor-toolbar' })
      }
    }

    window.addEventListener('message', handleOpenRequest)
    return () => window.removeEventListener('message', handleOpenRequest)
  }, [plugin, isAllowed, isOpen, serverOrigin, open, close, openPopover])

  const value = useMemo(
    () => ({
      isAvailable: plugin !== null,
      isOpen,
      isPopoverOpen,
      content: text?.content,
      target: text?.target,
      canReplace: text?.canReplace,
      documentType,
      source,
      popoverSource,
      draft: handOver?.draft ?? null,
      conversation: handOver?.conversation ?? null,
      handOverId: handOver?.id ?? null,
      documentData,
      skippedCells,
      open,
      close,
      openPopover,
      closePopover,
      applyResult,
      dismissSkippedCells
    }),
    [
      plugin,
      isOpen,
      isPopoverOpen,
      text,
      documentType,
      source,
      popoverSource,
      handOver,
      documentData,
      skippedCells,
      open,
      close,
      openPopover,
      closePopover,
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

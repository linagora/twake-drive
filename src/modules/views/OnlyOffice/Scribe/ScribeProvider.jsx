import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import logger from '@/lib/logger'
import {
  INSERT_SLIDE,
  INSERT_TABLE,
  makeTableMarkdown,
  normalizeSlide,
  normalizeTable
} from '@/modules/views/OnlyOffice/Scribe/capabilities'

const ScribeContext = createContext({ isAvailable: false, isOpen: false })

export const useScribe = () => useContext(ScribeContext)

/**
 * Talks to the scribe plugin of the Document Server (plugins/onlyoffice-scribe)
 * through postMessage. Without the plugin, there is no scribe.
 */
export const ScribeProvider = ({ serverUrl, documentType, children }) => {
  const serverOrigin = new URL(serverUrl).origin
  const [plugin, setPlugin] = useState(null)
  const [text, setText] = useState(null)

  useEffect(() => {
    const handleMessage = event => {
      if (event.origin !== serverOrigin) return

      const { type, content, target } = event.data ?? {}
      if (type === 'twake-scribe:ready') setPlugin(event.source)
      if (type === 'twake-scribe:content') setText({ content, target })
      if (type === 'twake-scribe:selection') {
        setText(current => (current === null ? null : { content, target }))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [serverOrigin])

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
      documentType,
      // The panel opens once the plugin answers with twake-scribe:content
      open: () =>
        plugin.postMessage({ type: 'twake-scribe:getContent' }, serverOrigin),
      close: () => setText(null),
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
  }, [plugin, text, serverOrigin, documentType])

  return (
    <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>
  )
}

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import logger from '@/lib/logger'
import {
  INSERT_CHART,
  INSERT_SLIDE,
  INSERT_TABLE,
  makeTableMarkdown,
  normalizeChart,
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
  const { showAlert } = useAlert()
  const { t } = useI18n()

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
      if (type === 'twake-scribe:notApplied') {
        showAlert({
          message: t('OnlyOffice.scribe.notApplied'),
          severity: 'secondary'
        })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [serverOrigin, showAlert, t])

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
      if (capability === INSERT_CHART && documentType === 'cell') {
        const chart = normalizeChart(params)
        return chart === null
          ? null
          : { type: 'twake-scribe:insertChart', ...chart }
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
      // The panel opens once the plugin answers with twake-scribe:content
      open: () =>
        plugin.postMessage({ type: 'twake-scribe:getContent' }, serverOrigin),
      // The plugin reads every selection while the panel is open, which
      // empties the redo of the editor: it stops once the panel is closed
      close: () => {
        plugin.postMessage({ type: 'twake-scribe:close' }, serverOrigin)
        setText(null)
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
  }, [plugin, text, serverOrigin, documentType])

  return (
    <ScribeContext.Provider value={value}>{children}</ScribeContext.Provider>
  )
}

import React, { useEffect, useRef } from 'react'

import IntentIframe from 'cozy-ui-plus/dist/Intent/IntentIframe'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import {
  makeCapabilities,
  makeSuggestions
} from '@/modules/views/OnlyOffice/Scribe/capabilities'

/**
 * The Assistant intent on the text of the scribe, in the panel or in the
 * popover. `layout`, `source`, `draft` and `conversation` are read by the
 * assistant at its opening only.
 *
 * @param {object} props
 * @param {'panel' | 'compact'} props.layout
 * @param {string | null} props.source - where the scribe was opened from
 * @param {string | null} [props.draft] - the text of the composer handed over
 * @param {string | null} [props.conversation] - the conversation handed over
 * @param {Function} props.onResult
 * @param {Function} props.onCancel
 */
export const ScribeIntent = ({
  layout,
  source,
  draft = null,
  conversation = null,
  onResult,
  onCancel
}) => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const { content, target, canReplace, documentType, documentData } =
    useScribe()
  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // The page of the assistant may say it is cancelled as it unloads with its
  // surface, once another surface has opened
  const handleEnd = () => {
    if (isMounted.current) onCancel()
  }

  // A selection that holds what an answer cannot give back, as an image or a
  // note, is not offered to be replaced. An older plugin does not tell.
  const answerActions =
    target === 'selection' && canReplace !== false
      ? ['insert', 'replace']
      : ['insert']
  const capabilities = makeCapabilities({ documentType, t })
  const suggestions = makeSuggestions({ documentType, t })
  const data = {
    content,
    answerActions: answerActions.map(name => ({
      name,
      label: t(`OnlyOffice.scribe.${name}`)
    })),
    // Left out when empty: the assistant then shows its own chips
    ...(capabilities.length > 0 && { capabilities }),
    ...(suggestions.length > 0 && { suggestions }),
    theme: { type: themeType },
    layout,
    source,
    ...(draft !== null && { draft }),
    ...(conversation !== null && { conversation }),
    // The plugin reads the whole document of a text document only
    documentAvailable: documentType === 'word',
    ...documentData
  }

  return (
    <IntentIframe
      action="OPEN"
      type="io.cozy.ai.chat.conversations"
      data={data}
      onResult={onResult}
      onCancel={handleEnd}
      onTerminate={handleEnd}
    />
  )
}

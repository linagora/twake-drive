import React from 'react'

import IntentIframe from 'cozy-ui-plus/dist/Intent/IntentIframe'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import {
  makeAnswerActions,
  makeCapabilities,
  makeInstructions,
  makeSuggestions
} from '@/modules/views/OnlyOffice/Scribe/capabilities'

export const ScribePanel = () => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const {
    isOpen,
    content,
    target,
    canReplace,
    documentType,
    close,
    applyResult
  } = useScribe()

  if (!isOpen) return null

  const answerActions = makeAnswerActions({ documentType, target, canReplace })
  const capabilities = makeCapabilities({ documentType, t })
  const suggestions = makeSuggestions({ documentType, t })
  const instructions = makeInstructions({ documentType })
  const data = {
    content,
    answerActions: answerActions.map(name => ({
      name,
      label: t(`OnlyOffice.scribe.${name}`)
    })),
    // Left out when empty: the assistant then shows its own chips
    ...(capabilities.length > 0 && { capabilities }),
    ...(suggestions.length > 0 && { suggestions }),
    ...(instructions !== null && { instructions }),
    theme: { type: themeType }
  }

  return (
    <aside
      className={styles['scribe-panel']}
      aria-label={t('OnlyOffice.scribe.open')}
    >
      <IntentIframe
        action="OPEN"
        type="io.cozy.ai.chat.conversations"
        data={data}
        onResult={applyResult}
        onCancel={close}
        onTerminate={close}
      />
    </aside>
  )
}

import React from 'react'

import IntentIframe from 'cozy-ui-plus/dist/Intent/IntentIframe'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { useAssistant } from '@/modules/views/Drive/Assistant/AssistantProvider'

export const AssistantPanel = () => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const { isOpen, close } = useAssistant()

  if (!isOpen) return null

  const data = {
    // Lets the assistant answer from the files of the user
    documents: true,
    theme: { type: themeType }
  }

  return (
    <aside
      className={`${styles['assistant-panel']} u-mv-1 u-mr-1 u-bdrs-8 u-ov-hidden u-m-0-m u-bdrs-0-m`}
      aria-label={t('Assistant.open')}
      data-testid="assistant-panel"
    >
      <IntentIframe
        action="OPEN"
        type="io.cozy.ai.chat.conversations"
        data={data}
        onCancel={close}
        onTerminate={close}
      />
    </aside>
  )
}

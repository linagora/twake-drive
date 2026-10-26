import React, { useEffect, useRef } from 'react'

import IntentIframe from 'cozy-ui-plus/dist/Intent/IntentIframe'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { useAssistant } from '@/modules/views/Drive/Assistant/AssistantProvider'

export const KEYBOARD_SAFE_HEIGHT = '--assistant-keyboard-safe-height'

/**
 * The keyboard of a phone covers the page instead of shrinking it, and the
 * assistant inside the iframe cannot see it: without this height, its
 * composer would stay hidden under the keyboard.
 */
const useKeyboardSafeHeight = (ref, isOpen) => {
  useEffect(() => {
    const viewport = window.visualViewport
    const panel = ref.current
    if (!viewport || !panel) return undefined

    const update = () => {
      const bottom = viewport.offsetTop + viewport.height
      panel.style.setProperty(
        KEYBOARD_SAFE_HEIGHT,
        `${Math.round(bottom - panel.getBoundingClientRect().top)}px`
      )
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [ref, isOpen])
}

export const AssistantPanel = () => {
  const { t } = useI18n()
  const { type: themeType } = useCozyTheme()
  const { isOpen, close } = useAssistant()
  const panelRef = useRef(null)
  useKeyboardSafeHeight(panelRef, isOpen)

  if (!isOpen) return null

  const data = {
    // Lets the assistant answer from the files of the user
    documents: true,
    theme: { type: themeType }
  }

  return (
    <aside
      ref={panelRef}
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

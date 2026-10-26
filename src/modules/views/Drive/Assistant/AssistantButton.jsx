import React from 'react'

import { Assistant, Icon } from '@linagora/twake-icons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useI18n } from 'twake-i18n'

/**
 * Takes the state of the assistant as props: on a phone the button is rendered
 * in the bar, outside the AssistantProvider
 */
export const AssistantButton = ({
  isAvailable,
  isKnowledgeBaseFolder,
  isOpen,
  open,
  close
}) => {
  const { t } = useI18n()

  // The Drive toolbar is also rendered by views without an AssistantProvider,
  // and the provider gives nothing without the flag
  if (!isAvailable || !isKnowledgeBaseFolder) return null

  const label = t('Assistant.open')

  return (
    <Tooltip title={label}>
      <IconButton
        className="u-mr-half"
        aria-label={label}
        aria-pressed={isOpen}
        onClick={isOpen ? close : open}
      >
        <Icon icon={Assistant} />
      </IconButton>
    </Tooltip>
  )
}

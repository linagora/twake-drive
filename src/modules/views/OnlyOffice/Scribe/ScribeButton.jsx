import { Assistant, Icon } from '@linagora/twake-icons'
import React from 'react'

import flag from 'cozy-flags'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useI18n } from 'twake-i18n'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

export const ScribeButton = () => {
  const { t } = useI18n()
  const { isPublic, isReadOnly } = useOnlyOfficeContext()
  const { isAvailable, isOpen, open, close } = useScribe()

  // A public link has no assistant, and a read-only document cannot take
  // its answers
  if (!isAvailable || isPublic || isReadOnly) return null
  if (!flag('cozy.assistant.enabled')) return null

  const label = t('OnlyOffice.scribe.open')

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

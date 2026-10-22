import React from 'react'

import { Assistant, Icon } from '@linagora/twake-icons'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import { useI18n } from 'twake-i18n'

import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import { isScribeAllowed } from '@/modules/views/OnlyOffice/Scribe/availability'

export const ScribeButton = () => {
  const { t } = useI18n()
  const isAllowed = isScribeAllowed(useOnlyOfficeContext())
  const { isAvailable, isOpen, open, close } = useScribe()

  if (!isAvailable || !isAllowed) return null

  const label = t('OnlyOffice.scribe.open')

  return (
    <Tooltip title={label}>
      <IconButton
        className="u-mr-half"
        aria-label={label}
        aria-pressed={isOpen}
        onClick={isOpen ? close : () => open({ source: 'toolbar' })}
      >
        <Icon icon={Assistant} />
      </IconButton>
    </Tooltip>
  )
}

import { Icon, Previous } from '@linagora/twake-icons'
import React from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useI18n } from 'twake-i18n'

export const BackButton = ({ onClick, ...props }) => {
  const { t } = useI18n()

  return (
    <IconButton onClick={onClick} {...props} aria-label={t('button.back')}>
      <Icon icon={Previous} />
    </IconButton>
  )
}

export default BackButton

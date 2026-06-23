import React from 'react'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import PreviousIcon from 'cozy-ui/transpiled/react/Icons/Previous'
import { useI18n } from 'twake-i18n'

export const BackButton = ({ onClick, ...props }) => {
  const { t } = useI18n()

  return (
    <IconButton onClick={onClick} {...props} aria-label={t('button.back')}>
      <Icon icon={PreviousIcon} />
    </IconButton>
  )
}

export default BackButton

import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import DotsIcon from 'cozy-ui/transpiled/react/Icons/Dots'

const MoreButton = ({ disabled, onClick, ...props }) => {
  const { t } = useI18n()

  return (
    <div>
      <IconButton
        data-testid="more-button"
        disabled={disabled}
        onClick={onClick}
        size="medium"
        aria-label={t('Toolbar.more')}
        {...props}
      >
        <Icon icon={DotsIcon} />
      </IconButton>
    </div>
  )
}

export default MoreButton

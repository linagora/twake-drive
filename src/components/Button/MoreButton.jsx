import { Icon, Dots } from '@linagora/twake-icons'
import React from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useI18n } from 'twake-i18n'

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
        <Icon icon={Dots} />
      </IconButton>
    </div>
  )
}

export default MoreButton

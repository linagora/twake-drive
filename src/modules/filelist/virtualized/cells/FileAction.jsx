import { Icon, Dots } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import { useI18n } from 'twake-i18n'

const FileAction = forwardRef(function FileAction({ onClick, disabled }, ref) {
  const { t } = useI18n()
  return (
    <ListItemIcon>
      <IconButton
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        arial-label={t('Toolbar.more')}
      >
        <Icon icon={Dots} />
      </IconButton>
    </ListItemIcon>
  )
})

export default FileAction

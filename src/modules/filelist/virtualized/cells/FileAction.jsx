import React, { forwardRef } from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import DotsIcon from 'cozy-ui/transpiled/react/Icons/Dots'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'

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
        <Icon icon={DotsIcon} />
      </IconButton>
    </ListItemIcon>
  )
})

export default FileAction

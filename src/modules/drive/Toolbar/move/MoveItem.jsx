import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import MovetoIcon from 'cozy-ui/transpiled/react/Icons/Moveto'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { navigateToModalWithMultipleFile } from '@/modules/actions/helpers'
import { isSharedDriveFolder } from '@/modules/shareddrives/helpers'

const MoveItem = ({ displayedFolder, hasWriteAccess }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { isMobile } = useBreakpoints()

  if (!hasWriteAccess || isSharedDriveFolder(displayedFolder)) {
    return null
  }

  const handleClick = () => {
    navigateToModalWithMultipleFile({
      files: [displayedFolder],
      pathname,
      navigate,
      path: 'move',
      search
    })
  }

  const label = isMobile
    ? t('SelectionBar.moveto_mobile')
    : t('SelectionBar.moveto')

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={MovetoIcon} />
      </ListItemIcon>
      <ListItemText primary={label} />
    </ActionsMenuItem>
  )
}

export default MoveItem

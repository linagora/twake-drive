import React, { useContext } from 'react'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import PlusIcon from 'cozy-ui/transpiled/react/Icons/Plus'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { AddMenuContext } from '@/modules/drive/AddMenu/AddMenuProvider'

const AddMenuItem = ({ onClick }) => {
  const { t } = useI18n()

  const {
    anchorRef,
    handleToggle,
    isDisabled,
    handleOfflineClick,
    isOffline,
    a11y
  } = useContext(AddMenuContext)

  const handleClick = () => {
    isOffline ? handleOfflineClick() : handleToggle()
    onClick()
  }

  return (
    <ActionsMenuItem
      ref={anchorRef}
      disabled={isDisabled || isOffline}
      onClick={handleClick}
      {...a11y}
    >
      <ListItemIcon>
        <Icon icon={<Icon icon={PlusIcon} />} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_add_item')} />
    </ActionsMenuItem>
  )
}

export default AddMenuItem

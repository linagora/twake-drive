import { Icon, Plus } from '@linagora/twake-icons'
import React, { useContext } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useI18n } from 'twake-i18n'

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
        <Icon icon={<Icon icon={Plus} />} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_add_item')} />
    </ActionsMenuItem>
  )
}

export default AddMenuItem

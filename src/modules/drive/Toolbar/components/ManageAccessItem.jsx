import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import PeopleIcon from 'cozy-ui/transpiled/react/Icons/People'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const ManageAccessItem = ({ onClick }) => {
  const navigate = useNavigate()
  const { t } = useI18n()

  const handleClick = () => {
    navigate('./share')
    onClick()
  }

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={PeopleIcon} />
      </ListItemIcon>
      <ListItemText primary={t('toolbar.menu_manage_access')} />
    </ActionsMenuItem>
  )
}

export default ManageAccessItem

import { Icon, FileTypeFolder } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const addFolder = ({ t }) => {
  const label = t('toolbar.menu_new_folder')
  const icon = FileTypeFolder

  return {
    name: 'addFolder',
    label,
    icon,
    action: () => {},
    disabled: () => true,
    Component: forwardRef(function AddFolder(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ActionsMenuItem>
      )
    })
  }
}

export { addFolder }

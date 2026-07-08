import { Icon, Trash } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const trash = ({ t }) => {
  const label = t('SelectionBar.trash')
  const icon = Trash

  return {
    name: 'trash',
    label,
    icon,
    action: () => {},
    disabled: () => true,
    Component: forwardRef(function DeleteNextcloudFile(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} color="var(--errorColor)" />
          </ListItemIcon>
          <ListItemText
            primary={label}
            primaryTypographyProps={{ color: 'error' }}
          />
        </ActionsMenuItem>
      )
    })
  }
}

export { trash }

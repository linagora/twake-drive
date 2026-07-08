import { Icon, Rename } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const rename = ({ t }) => {
  const label = t('SelectionBar.rename')
  const icon = Rename

  return {
    name: 'rename',
    label,
    icon,
    displayCondition: docs => docs.length === 1,
    action: () => {},
    disabled: () => true,
    Component: forwardRef(function Rename(props, ref) {
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

export { rename }

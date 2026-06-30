import { Icon, CheckSquare } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

const makeComponent = (label, icon) => {
  const Component = forwardRef((props, ref) => {
    return (
      <ActionsMenuItem {...props} ref={ref}>
        <ListItemIcon>
          <Icon icon={icon} />
        </ListItemIcon>
        <ListItemText primary={label} />
      </ActionsMenuItem>
    )
  })
  Component.displayName = 'Select'

  return Component
}

export const select = ({ t, showSelectionBar }) => {
  const label = t('toolbar.menu_select')
  const icon = CheckSquare

  return {
    name: 'select',
    label,
    icon,
    displayCondition: files => files.length > 1,
    action: () => showSelectionBar(),
    Component: makeComponent(label, icon)
  }
}

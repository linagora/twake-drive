import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import RestoreIcon from 'cozy-ui/transpiled/react/Icons/Restore'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { restoreFiles } from './utils'

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
  Component.displayName = 'Restore'

  return Component
}

export const restore = ({ t, refresh, client }) => {
  const label = t('SelectionBar.restore')
  const icon = RestoreIcon

  return {
    name: 'restore',
    label,
    icon,
    allowTrashed: true,
    action: async files => {
      await restoreFiles(client, files)
      refresh()
    },
    Component: makeComponent(label, icon)
  }
}

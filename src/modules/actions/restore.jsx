import React, { forwardRef } from 'react'

import { Icon, Restore } from '@linagora/twake-icons'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { hasWriteAccessToItems } from './helpers'
import { restoreFiles } from './utils'

import { isTrashedDocument } from '@/modules/filelist/helpers'

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

export const restore = ({ t, refresh, client, hasItemWriteAccess }) => {
  const label = t('SelectionBar.restore')
  const icon = Restore

  return {
    name: 'restore',
    label,
    icon,
    allowTrashed: true,
    displayCondition: files =>
      files.every(isTrashedDocument) &&
      hasWriteAccessToItems(files, hasItemWriteAccess),
    action: async files => {
      await restoreFiles(client, files)
      refresh()
    },
    Component: makeComponent(label, icon)
  }
}

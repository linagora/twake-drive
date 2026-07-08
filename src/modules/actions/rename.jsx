import { Icon, Rename } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { startRenamingAsync } from '@/modules/drive/rename'
import { isSharedDriveDoc } from '@/modules/shareddrives/helpers'

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
  Component.displayName = 'Rename'

  return Component
}

export const rename = ({
  t,
  hasWriteAccess,
  dispatch,
  shouldHideIfSharedDriveRecipient
}) => {
  const label = t('SelectionBar.rename')
  const icon = Rename

  return {
    name: 'rename',
    label,
    icon,
    displayCondition: selection => {
      // special case for rename in sharings tab
      const isAllowedForSharedDrive = shouldHideIfSharedDriveRecipient
        ? !isSharedDriveDoc(selection[0])
        : true
      return selection.length === 1 && hasWriteAccess && isAllowedForSharedDrive
    },
    action: files => {
      // Use setTimeout to defer dispatch until after click event completes
      // This prevents focus loss on the rename input
      setTimeout(() => {
        dispatch(startRenamingAsync(files[0]))
      }, 0)
    },
    Component: makeComponent(label, icon)
  }
}

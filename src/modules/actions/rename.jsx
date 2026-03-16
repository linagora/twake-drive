import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import RenameIcon from 'cozy-ui/transpiled/react/Icons/Rename'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { startRenamingAsync } from '@/modules/drive/rename'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

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
  const icon = RenameIcon

  return {
    name: 'rename',
    label,
    icon,
    displayCondition: selection => {
      // special case for rename in sharings tab
      const isAllowedForSharedDrive = shouldHideIfSharedDriveRecipient
        ? !isFromSharedDriveRecipient(selection[0])
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

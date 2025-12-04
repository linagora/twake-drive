import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import RenameIcon from 'cozy-ui/transpiled/react/Icons/Rename'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import {
  isFolderFromSharedDriveOwner,
  isSharedDriveFolder
} from '../shareddrives/helpers'

import { startRenamingAsync } from '@/modules/drive/rename'

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

export const rename = ({ t, hasWriteAccess, dispatch }) => {
  const label = t('SelectionBar.rename')
  const icon = RenameIcon

  return {
    name: 'rename',
    label,
    icon,
    displayCondition: selection =>
      selection.length === 1 &&
      (hasWriteAccess ||
        (isSharedDriveFolder(selection[0]) &&
          isFolderFromSharedDriveOwner(selection[0]))),
    action: files => dispatch(startRenamingAsync(files[0])),
    Component: makeComponent(label, icon)
  }
}

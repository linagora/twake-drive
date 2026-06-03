import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import {
  isFileRootSharedDrive,
  navigateToFileRootShare
} from '@/modules/shareddrives/rootFileNavigation'

// Only for sharing tabs. Mutually exclusive with `shareSharedDrive`: that one
// handles folder-root shared drives, this one handles file-root shared drives.
export const shareFileRootSharedDrive = ({
  navigate,
  t,
  isOwner,
  pathname
}) => {
  const label = t('Files.share.cta')
  const icon = ShareIcon

  return {
    name: 'shareFileRootSharedDrive',
    label,
    icon,
    displayCondition: docs => {
      const [doc] = docs

      return (
        docs.length === 1 && isFileRootSharedDrive(doc) && isOwner?.(doc._id)
      )
    },
    action: docs => {
      navigateToFileRootShare({ navigate, file: docs[0], pathname })
    },
    Component: forwardRef(function ShareFileRootSharedDrive(props, ref) {
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

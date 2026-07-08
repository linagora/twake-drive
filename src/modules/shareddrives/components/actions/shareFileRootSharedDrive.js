import { Icon, Share } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { makeFileSharePath } from '@/modules/filelist/sharePath'
import { isFileRootSharedDrive } from '@/modules/shareddrives/rootFileNavigation'

// Only for sharing tabs. Mutually exclusive with `shareSharedDrive`: that one
// handles folder-root shared drives, this one handles file-root shared drives.
export const shareFileRootSharedDrive = ({
  navigate,
  t,
  isOwner,
  pathname
}) => {
  const label = t('Files.share.cta')
  const icon = Share

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
    // Same route the avatars build, so the share button layers the modal over
    // the sharings list instead of navigating into the shared-drive view.
    action: docs => {
      navigate(makeFileSharePath({ file: docs[0], pathname }))
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

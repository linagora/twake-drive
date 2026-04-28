import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DownloadIcon from 'cozy-ui/transpiled/react/Icons/Download'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { downloadFiles } from './utils'

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
  Component.displayName = 'Download'

  return Component
}

export const download = ({
  client,
  t,
  showAlert,
  shouldHideIfSharedDriveRecipient,
  isSelectAll,
  displayedFolder
}) => {
  const label = t('SelectionBar.download')
  const icon = DownloadIcon

  return {
    name: 'download',
    label,
    icon,
    allowInfectedFiles: false,
    displayCondition: files => {
      // For sharing tab where we can see multiple shared folders as
      // recipient, disable download because we cannot download different
      // shared folders at the same time.
      if (
        shouldHideIfSharedDriveRecipient &&
        files.length > 1 &&
        files.some(file => isFromSharedDriveRecipient(file))
      ) {
        return false
      }
      return files.length > 0
    },
    action: files => {
      let selectedFiles = files
      if (isSelectAll) {
        selectedFiles = [displayedFolder]
      }
      return downloadFiles(client, selectedFiles, { showAlert, t })
    },
    Component: makeComponent(label, icon)
  }
}

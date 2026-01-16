import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DownloadIcon from 'cozy-ui/transpiled/react/Icons/Download'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { downloadFiles } from './utils'

import { isEncryptedFolder, isEncryptedFile } from '@/lib/encryption'

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
  vaultClient,
  showAlert,
  driveId,
  isSelectAll,
  displayedFolder,
  isInfected
}) => {
  const label = t('SelectionBar.download')
  const icon = DownloadIcon

  return {
    name: 'download',
    label,
    icon,
    displayCondition: files => {
      // We cannot generate archive for encrypted files, for now.
      // Then, we do not display the download button when the selection
      // includes an encrypted folder or several encrypted files
      return (
        !isInfected &&
        files.length > 0 &&
        !files.some(file => isEncryptedFolder(file)) &&
        !(files.length > 1 && files.some(file => isEncryptedFile(file)))
      )
    },
    action: files => {
      let selectedFiles = files
      if (isSelectAll) {
        selectedFiles = [displayedFolder]
      }
      return downloadFiles(
        client,
        selectedFiles,
        { vaultClient, showAlert, t },
        driveId
      )
    },
    Component: makeComponent(label, icon)
  }
}

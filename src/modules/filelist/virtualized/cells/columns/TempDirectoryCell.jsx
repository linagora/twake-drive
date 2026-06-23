import React from 'react'

import { useVaultClient } from 'cozy-keys-lib'

import AddFolder from '@/modules/filelist/AddFolder'

/**
 * Renders the "new folder being typed" row in the file list. Only the name
 * column shows the input; the menu column renders nothing; every other
 * column falls back to an em-dash.
 */
const TempDirectoryCell = ({
  column,
  currentFolderId,
  refreshFolderContent,
  driveId
}) => {
  const vaultClient = useVaultClient()
  if (column.id === 'name') {
    return (
      <AddFolder
        vaultClient={vaultClient}
        currentFolderId={currentFolderId}
        refreshFolderContent={refreshFolderContent}
        driveId={driveId}
      />
    )
  }
  if (column.id === 'menu') return null
  return '—'
}

export default TempDirectoryCell

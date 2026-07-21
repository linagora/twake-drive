import React from 'react'
import { Outlet } from 'react-router-dom'

import flag from 'cozy-flags'

import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import { SharedDriveBreadcrumb } from '@/modules/shareddrives/components/SharedDriveBreadcrumb'
import { SharedDriveFolderBody } from '@/modules/shareddrives/components/SharedDriveFolderBody'
import Dropzone from '@/modules/upload/Dropzone'
import DropzoneDnD from '@/modules/upload/DropzoneDnD'
import FolderViewHeader from '@/modules/views/Folder/FolderViewHeader'
import FolderViewBodyVz from '@/modules/views/Folder/virtualized/FolderViewBody'

const SharedDriveFolderContent = ({
  actions,
  queryResults,
  folderId,
  displayedFolder,
  canWriteToCurrentFolder,
  driveId,
  isInRootOfSharedDrive,
  sortOrder,
  setSortOrder,
  isSettingsLoaded,
  isFabDisplayed,
  refresh,
  isSelectionBarVisible,
  isMobile
}) => {
  const DropzoneComp =
    flag('drive.virtualization.enabled') && !isMobile ? DropzoneDnD : Dropzone

  return (
    <DropzoneComp
      disabled={!canWriteToCurrentFolder}
      displayedFolder={displayedFolder}
    >
      <FolderViewHeader>
        <SharedDriveBreadcrumb driveId={driveId} folderId={folderId} />
        <Toolbar
          canUpload={false}
          canCreateFolder={canWriteToCurrentFolder}
          driveId={driveId}
          showShareButton={isInRootOfSharedDrive}
        />
      </FolderViewHeader>

      {flag('drive.virtualization.enabled') && !isMobile ? (
        <FolderViewBodyVz
          actions={actions}
          queryResults={queryResults}
          currentFolderId={folderId}
          displayedFolder={displayedFolder}
          canDrag
          canUpload={canWriteToCurrentFolder}
          withFilePath={false}
          driveId={driveId}
          orderProps={{
            sortOrder,
            setOrder: setSortOrder,
            isSettingsLoaded
          }}
        />
      ) : (
        <SharedDriveFolderBody
          folderId={folderId}
          queryResults={queryResults}
        />
      )}
      <Outlet />
      {isFabDisplayed && (
        <AddMenuProvider
          componentsProps={{
            AddMenu: {
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left'
              }
            }
          }}
          canCreateFolder={true}
          canUpload={true}
          disabled={false}
          refreshFolderContent={refresh}
          displayedFolder={displayedFolder}
          isSelectionBarVisible={isSelectionBarVisible}
        >
          <FabWithAddMenuContext />
        </AddMenuProvider>
      )}
    </DropzoneComp>
  )
}

export { SharedDriveFolderContent }

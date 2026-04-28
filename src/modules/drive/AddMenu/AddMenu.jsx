import React from 'react'

import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'

import AddMenuContent from '@/modules/drive/AddMenu/AddMenuContent'

const AddMenu = ({
  anchorRef,
  handleClose,
  isUploadDisabled,
  canCreateFolder,
  canUpload,
  refreshFolderContent,
  isPublic,
  displayedFolder,
  isReadOnly,
  ...actionMenuProps
}) => {
  return (
    <ActionsMenu
      open
      ref={anchorRef}
      onClose={handleClose}
      docs={[displayedFolder]}
      actions={[]}
      {...actionMenuProps}
    >
      <AddMenuContent
        isUploadDisabled={isUploadDisabled}
        canCreateFolder={canCreateFolder}
        canUpload={canUpload}
        refreshFolderContent={refreshFolderContent}
        isPublic={isPublic}
        displayedFolder={displayedFolder}
        onClick={handleClose}
        isReadOnly={isReadOnly}
      />
    </ActionsMenu>
  )
}

export default AddMenu

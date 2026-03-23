import React from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'

import { LoaderModal } from '@/components/LoaderModal'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { DuplicateModal } from '@/modules/duplicate/components/DuplicateModal'
import { useQueryMultipleSharedDriveFolders } from '@/modules/shareddrives/hooks/useQueryMultipleSharedDriveFolders'

const DuplicateSharedDriveFilesView = () => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { driveId } = useParams()
  const { displayedFolder } = useDisplayedFolder()

  const { sharedDriveResults } = useQueryMultipleSharedDriveFolders({
    folderIds: state?.fileIds ?? [],
    driveId
  })

  if (sharedDriveResults && displayedFolder) {
    const onClose = () => {
      navigate('..', { replace: true })
    }

    const entries = sharedDriveResults.map(file => ({
      ...file,
      path: `${displayedFolder.path}/${file.name}`
    }))

    return (
      <DuplicateModal
        currentFolder={displayedFolder}
        entries={entries}
        onClose={onClose}
        showSharedDriveFolder={true}
      />
    )
  }

  return <LoaderModal />
}

export { DuplicateSharedDriveFilesView }

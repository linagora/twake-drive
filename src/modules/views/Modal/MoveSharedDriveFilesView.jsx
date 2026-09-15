import React from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'

import { LoaderModal } from '@/components/LoaderModal'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import MoveModal from '@/modules/move/MoveModal'
import { useQueryMultipleSharedDriveFolders } from '@/modules/shareddrives/hooks/useQueryMultipleSharedDriveFolders'

const MoveSharedDriveFilesView = ({ isOpenInViewer }) => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { displayedFolder } = useDisplayedFolder()

  const hasFileIds = state?.fileIds !== null && state?.fileIds !== undefined

  const { sharedDriveResults } = useQueryMultipleSharedDriveFolders({
    folderIds: hasFileIds ? state.fileIds : [],
    driveId: displayedFolder?.driveId
  })

  if (!hasFileIds) {
    return <Navigate to=".." replace={true} />
  }

  if (sharedDriveResults && displayedFolder) {
    const onClose = () => {
      navigate('..', { replace: true })
    }

    const onMovingSuccess = () => {
      navigate(isOpenInViewer ? '../..' : '..', { replace: true })
    }

    const showNextcloudFolder = !sharedDriveResults.some(
      file => file.type === 'directory'
    )

    const entries = sharedDriveResults.map(file => ({
      ...file,
      path: `${displayedFolder.path}/${file.name}`
    }))

    return (
      <MoveModal
        currentFolder={displayedFolder}
        entries={entries}
        onClose={onClose}
        onMovingSuccess={onMovingSuccess}
        showNextcloudFolder={showNextcloudFolder}
        showSharedDriveFolder={true}
        driveId={displayedFolder.driveId}
      />
    )
  }

  return <LoaderModal />
}

export { MoveSharedDriveFilesView }

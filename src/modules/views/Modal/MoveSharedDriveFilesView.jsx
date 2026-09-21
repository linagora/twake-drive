import React from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'

import { LoaderModal } from '@/components/LoaderModal'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import MoveModal from '@/modules/move/MoveModal'
import { useQueryMultipleSharedDriveFolders } from '@/modules/shareddrives/hooks/useQueryMultipleSharedDriveFolders'

const MoveSharedDriveFilesView = ({ isOpenInViewer }) => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { driveId } = useParams()
  const { displayedFolder } = useDisplayedFolder()

  const hasFileIds = state?.fileIds !== null && state?.fileIds !== undefined

  const { sharedDriveResults } = useQueryMultipleSharedDriveFolders({
    folderIds: hasFileIds ? state.fileIds : [],
    driveId
  })

  if (!hasFileIds) {
    return <Navigate to=".." replace={true} />
  }

  if (sharedDriveResults && displayedFolder) {
    // Moved files leave the current folder, so closing from the viewer returns
    // to the folder rather than the now-stale file viewer.
    const onClose = () => {
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
        showNextcloudFolder={showNextcloudFolder}
        showSharedDriveFolder={true}
        driveId={driveId}
      />
    )
  }

  return <LoaderModal />
}

export { MoveSharedDriveFilesView }

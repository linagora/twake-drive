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
    const onClose = () => {
      navigate('..', { replace: true })
    }

    const onMovingSuccess = () => {
      navigate(isOpenInViewer ? '../..' : '..', { replace: true })
    }

    const showNextcloudFolder = !sharedDriveResults.some(
      file => file.type === 'directory'
    )
    const displayedFolderPath = displayedFolder.path.startsWith(
      '/Shared drives/'
    )
      ? displayedFolder.path
      : `/Shared drives${displayedFolder.path}`

    const entries = sharedDriveResults.map(file => ({
      ...file,
      path: `${displayedFolderPath}/${file.name}`
    }))

    return (
      <MoveModal
        currentFolder={displayedFolder}
        entries={entries}
        onClose={onClose}
        onMovingSuccess={onMovingSuccess}
        showNextcloudFolder={showNextcloudFolder}
        showSharedDriveFolder={true}
        driveId={driveId}
      />
    )
  }

  return <LoaderModal />
}

export { MoveSharedDriveFilesView }

import React from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'

import { LoaderModal } from '@/components/LoaderModal'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import MoveModal from '@/modules/move/MoveModal'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'
import { buildParentsByIdsQuery } from '@/queries'

const MoveFilesView = ({ isOpenInViewer }) => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { displayedFolder } = useDisplayedFolder()
  const { sharedDrives } = useSharedDrives()

  const hasFileIds = state?.fileIds != undefined

  const fileQuery = buildParentsByIdsQuery(hasFileIds ? state.fileIds : [])
  const fileResult = useQuery(fileQuery.definition, {
    ...fileQuery.options,
    enabled: hasFileIds
  })

  if (!hasFileIds) {
    return <Navigate to=".." replace={true} />
  }

  if (hasQueryBeenLoaded(fileResult) && fileResult.data && displayedFolder) {
    const onClose = () => {
      navigate('..', { replace: true })
    }

    const onMovingSuccess = () => {
      /**
       * In file viewer, after moving success the file will not exist in the current folder,
       * we should navigate to current folder view instead.
       * */
      navigate(isOpenInViewer ? '../..' : '..', { replace: true })
    }

    const showNextcloudFolder = !fileResult.data.some(
      file => file.type === 'directory'
    )

    return (
      <MoveModal
        currentFolder={displayedFolder}
        entries={fileResult.data}
        onClose={onClose}
        onMovingSuccess={onMovingSuccess}
        showNextcloudFolder={showNextcloudFolder}
        showSharedDriveFolder={sharedDrives?.length > 0}
      />
    )
  }

  return <LoaderModal />
}

export { MoveFilesView }

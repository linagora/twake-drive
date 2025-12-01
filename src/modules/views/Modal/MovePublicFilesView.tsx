import React from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import usePublicFileByIdsQuery from '../Public/usePublicFileByIdsQuery'

import { LoaderModal } from '@/components/LoaderModal'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import MoveModal from '@/modules/move/MoveModal'

interface LocationState {
  fileIds?: string[]
}

const MovePublicFilesView = (): React.ReactElement => {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState | null }
  const { displayedFolder } = useDisplayedFolder()

  const hasFileIds = state?.fileIds !== undefined

  const { files, fetchStatus } = usePublicFileByIdsQuery(
    state?.fileIds ?? ([] as string[])
  )

  if (!hasFileIds) {
    return <Navigate to=".." replace={true} />
  }

  if (fetchStatus === 'loaded' && files.length && displayedFolder) {
    const onClose = (): void => {
      navigate('..', { replace: true })
    }

    const onMovingSuccess = (): void => {
      navigate('..', { replace: true, state: { refresh: true } })
    }

    return (
      <MoveModal
        currentFolder={displayedFolder}
        entries={files}
        onClose={onClose}
        onMovingSuccess={onMovingSuccess}
        isPublic
        showNextcloudFolder={false}
      />
    )
  }

  return <LoaderModal />
}

export { MovePublicFilesView }

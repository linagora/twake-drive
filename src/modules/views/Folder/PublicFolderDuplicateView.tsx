import React, { FC } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import usePublicFileByIdsQuery from '../Public/usePublicFileByIdsQuery'

import { LoaderModal } from '@/components/LoaderModal'
import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { DuplicateModal } from '@/modules/duplicate/components/DuplicateModal'

const PublicFolderDuplicateView: FC = () => {
  const navigate = useNavigate()
  const { state } = useLocation() as {
    state: { fileIds?: string[] }
  }
  const { displayedFolder } = useDisplayedFolder()

  const hasFileIds = state.fileIds != undefined

  const { files, fetchStatus } = usePublicFileByIdsQuery(
    state.fileIds ?? ([] as string[])
  )

  if (!hasFileIds) {
    return <Navigate to=".." replace={true} />
  }

  if (fetchStatus === 'loaded' && files.length && displayedFolder) {
    const onClose = (): void => {
      navigate('..', { replace: true })
    }

    return (
      <DuplicateModal
        currentFolder={displayedFolder}
        entries={files}
        onClose={onClose}
        isPublic
      />
    )
  }

  return <LoaderModal />
}

export { PublicFolderDuplicateView }

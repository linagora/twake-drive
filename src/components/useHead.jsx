import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import useUpdateFavicon from '@/hooks/useUpdateFavicon'
import useUpdateDocumentTitle from '@/modules/views/useUpdateDocumentTitle'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFolderQuery
} from '@/queries'

const useHead = () => {
  const { driveId, folderId, fileId } = useParams()

  const isFileOpen = useMemo(() => fileId !== undefined, [fileId])

  const fileQuery = driveId
    ? buildSharedDriveFolderQuery({
        driveId,
        folderId: isFileOpen ? fileId : folderId
      })
    : buildFileOrFolderByIdQuery(isFileOpen ? fileId : folderId)
  const { data: file, fetchStatus } = useQuery(
    fileQuery.definition,
    fileQuery.options
  )

  useUpdateDocumentTitle(file, fetchStatus)
  useUpdateFavicon(file, fetchStatus)
}

export default useHead

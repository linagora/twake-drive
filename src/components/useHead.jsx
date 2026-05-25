import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import { ROOT_DIR_ID } from '@/constants/config'
import useUpdateFavicon from '@/hooks/useUpdateFavicon'
import { usePublicContext } from '@/modules/public/PublicProvider'
import useUpdateDocumentTitle from '@/modules/views/useUpdateDocumentTitle'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFolderQuery
} from '@/queries'

const useHead = ({ title } = {}) => {
  const { driveId, folderId, fileId } = useParams()
  const { isPublic } = usePublicContext()

  const isFileOpen = useMemo(() => fileId !== undefined, [fileId])

  const id = isFileOpen ? fileId : folderId

  // Public-share tokens cannot read the instance root directory; the query
  // would 403 and leak as an unhandled rejection through useQuery.
  const isForbiddenRootOnPublic = isPublic && id === ROOT_DIR_ID

  const fileQuery = driveId
    ? buildSharedDriveFolderQuery({ driveId, folderId: id })
    : buildFileOrFolderByIdQuery(id)
  const { data: file, fetchStatus } = useQuery(fileQuery.definition, {
    ...fileQuery.options,
    enabled: fileQuery.options.enabled !== false && !isForbiddenRootOnPublic
  })

  useUpdateDocumentTitle(file, fetchStatus, title)
  useUpdateFavicon(file, fetchStatus)
}

export default useHead

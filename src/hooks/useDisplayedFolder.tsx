import { useParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'

import { ROOT_DIR_ID } from '@/constants/config'
import useCurrentFolderId from '@/hooks/useCurrentFolderId'
import { usePublicContext } from '@/modules/public/PublicProvider'
import {
  buildFileOrFolderByIdQuery,
  buildSharedDriveFileOrFolderByIdQuery
} from '@/queries'

interface DisplayedFolderResult {
  isNotFound: boolean
  displayedFolder: IOCozyFile | null
  initialDirId: string | null
  isLoading: boolean
}

// The folder request is still resolving until it settles (loaded or failed).
// Using a lookup instead of two comparisons keeps callers branch-free.
const SETTLED_STATUSES = ['loaded', 'failed']

const useDisplayedFolder = (): DisplayedFolderResult => {
  const { isPublic } = usePublicContext()
  const { driveId } = useParams<{ driveId: string }>()
  const currentFolderId = useCurrentFolderId()
  const folderId = currentFolderId ?? ROOT_DIR_ID

  // Public-share tokens cannot read the instance root directory, so the query
  // would 403. cozy-client's useQuery does not catch that rejection, so it
  // surfaces as an unhandled promise rejection. Skip it.
  const isForbiddenRootOnPublic = isPublic && folderId === ROOT_DIR_ID

  // A parent view sees the driveId of its child route (the share modal of a
  // drive file, an editor) while the route holds no folder of that drive. The
  // instance root cannot be read through the drive: there is no folder to show.
  const hasNoDriveFolder = Boolean(driveId) && !currentFolderId

  const folderQuery = driveId
    ? buildSharedDriveFileOrFolderByIdQuery({ fileId: folderId, driveId })
    : buildFileOrFolderByIdQuery(folderId)
  const folderResult = useQuery(folderQuery.definition, {
    ...folderQuery.options,
    enabled:
      folderQuery.options.enabled !== false &&
      !isForbiddenRootOnPublic &&
      !hasNoDriveFolder
  }) as unknown as {
    data?: IOCozyFile | null
    fetchStatus: string
    lastError: { status: number }
  }

  // A disabled query stays `pending`, which would read as loading forever.
  if (hasNoDriveFolder) {
    return {
      isNotFound: false,
      displayedFolder: null,
      initialDirId: null,
      isLoading: false
    }
  }

  const displayedFolder = folderResult.data ?? null
  const initialDirId = displayedFolder?.id ?? null
  const isLoading = !SETTLED_STATUSES.includes(folderResult.fetchStatus)

  if (folderId) {
    const isNotFound =
      folderResult.fetchStatus === 'failed' &&
      folderResult.lastError.status === 404

    return {
      isNotFound,
      displayedFolder,
      initialDirId,
      isLoading
    }
  }

  return {
    isNotFound: true,
    displayedFolder: null,
    initialDirId: null,
    isLoading
  }
}

export default useDisplayedFolder

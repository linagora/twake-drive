import { useQuery } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'

import { ROOT_DIR_ID } from '@/constants/config'
import useCurrentFolderId from '@/hooks/useCurrentFolderId'
import { usePublicContext } from '@/modules/public/PublicProvider'
import { buildFileOrFolderByIdQuery } from '@/queries'

interface DisplayedFolderResult {
  isNotFound: boolean
  displayedFolder: IOCozyFile | null
  initialDirId: string | null
}

const useDisplayedFolder = (): DisplayedFolderResult => {
  const { isPublic } = usePublicContext()
  const folderId = useCurrentFolderId() ?? ROOT_DIR_ID

  // Public-share tokens cannot read the instance root directory, so the query
  // would 403. cozy-client's useQuery does not catch that rejection, so it
  // surfaces as an unhandled promise rejection. Skip it.
  const isForbiddenRootOnPublic = isPublic && folderId === ROOT_DIR_ID

  const folderQuery = buildFileOrFolderByIdQuery(folderId)
  const folderResult = useQuery(folderQuery.definition, {
    ...folderQuery.options,
    enabled: folderQuery.options.enabled !== false && !isForbiddenRootOnPublic
  }) as unknown as {
    data?: IOCozyFile | null
    fetchStatus: string
    lastError: { status: number }
  }

  const displayedFolder = folderResult.data ?? null
  const initialDirId = displayedFolder?.id ?? null

  if (folderId) {
    const isNotFound =
      folderResult.fetchStatus === 'failed' &&
      folderResult.lastError.status === 404

    return {
      isNotFound,
      displayedFolder,
      initialDirId
    }
  }

  return {
    isNotFound: true,
    displayedFolder: null,
    initialDirId: null
  }
}

export default useDisplayedFolder

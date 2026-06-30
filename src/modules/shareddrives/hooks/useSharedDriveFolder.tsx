import { useQuery } from 'cozy-client'
import type { IOCozyFile } from 'cozy-client/types/types'

import { useFolderSort } from '@/hooks'
import { buildSharedDriveFolderMangoQuery } from '@/queries'
import type { QueryConfig } from '@/queries'

interface SharedDriveFolderProps {
  driveId: string
  folderId: string
}

interface SharedDriveFolderReturn {
  sharedDriveQuery: QueryConfig
  sharedDriveResult: {
    data?: IOCozyFile[] | null
  }
  fetchStatus: string
  lastUpdate: number | null
  hasMore: boolean
  fetchMore: () => Promise<void>
}

const useSharedDriveFolder = ({
  driveId,
  folderId
}: SharedDriveFolderProps): SharedDriveFolderReturn => {
  const [sort, , isSettingsLoaded] = useFolderSort(folderId)

  const q = buildSharedDriveFolderMangoQuery({
    driveId,
    folderId,
    sortAttribute: sort.attribute,
    sortOrder: sort.order
  })

  const query = useQuery(q.definition, {
    ...q.options,
    enabled: isSettingsLoaded && !!driveId && !!folderId
  })

  return {
    sharedDriveQuery: q,
    sharedDriveResult: { data: query.data },
    fetchStatus: query.fetchStatus,
    lastUpdate: query.lastUpdate,
    hasMore: query.hasMore,
    fetchMore: query.fetchMore
  }
}

export { useSharedDriveFolder }

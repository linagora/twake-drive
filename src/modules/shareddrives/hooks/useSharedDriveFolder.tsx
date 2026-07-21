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

  // While sort settings are loading, the query is gated off and useQuery
  // returns fetchStatus: 'pending'. getFolderViewState only treats 'loading'
  // (with no lastUpdate) as a loading state, so we normalise to 'loading'
  // to avoid a brief empty-state flash before settings are ready.
  const fetchStatus = isSettingsLoaded ? query.fetchStatus : 'loading'

  return {
    sharedDriveQuery: q,
    sharedDriveResult: { data: query.data },
    fetchStatus,
    lastUpdate: query.lastUpdate,
    hasMore: query.hasMore,
    fetchMore: query.fetchMore
  }
}

export { useSharedDriveFolder }

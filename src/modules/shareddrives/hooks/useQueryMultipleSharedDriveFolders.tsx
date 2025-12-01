import { useCallback, useEffect, useMemo, useState } from 'react'

import { useClient } from 'cozy-client'
import type { IOCozyFile } from 'cozy-client/types/types'

import { buildSharedDriveFolderQuery } from '@/queries'

interface UseQueryMultipleSharedDriveFoldersProps {
  driveId: string
  folderIds: string[]
}

interface SharedDriveResult {
  data: IOCozyFile | null
}

interface SharedDriveFolderReturn {
  sharedDriveResults: IOCozyFile[] | null
}

const useQueryMultipleSharedDriveFolders = ({
  driveId,
  folderIds
}: UseQueryMultipleSharedDriveFoldersProps): SharedDriveFolderReturn => {
  const client = useClient()

  const [sharedDriveResults, setSharedDriveResults] = useState<
    SharedDriveFolderReturn['sharedDriveResults']
  >([])

  const sharedDriveQueries = useMemo(
    () =>
      folderIds.map(folderId =>
        buildSharedDriveFolderQuery({
          driveId,
          folderId
        })
      ),
    [driveId, folderIds]
  )

  const fetchSharedDriveResults = useCallback(async () => {
    const results = (await Promise.all(
      sharedDriveQueries.map(async query => {
        return client?.query(query.definition(), query.options)
      })
    )) as SharedDriveResult[]

    setSharedDriveResults(
      results.map(
        (result: SharedDriveResult) => result.data
      ) as SharedDriveFolderReturn['sharedDriveResults']
    )
  }, [client, sharedDriveQueries])

  useEffect(() => {
    if (client) {
      void fetchSharedDriveResults()
    }
  }, [client, fetchSharedDriveResults])

  return {
    sharedDriveResults
  }
}

export { useQueryMultipleSharedDriveFolders }

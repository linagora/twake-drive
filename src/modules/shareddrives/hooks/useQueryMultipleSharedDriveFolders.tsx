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

  const [sharedDriveResults, setSharedDriveResults] =
    useState<SharedDriveFolderReturn['sharedDriveResults']>(null)

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

  const fetchSharedDriveResults = useCallback(async (): Promise<
    SharedDriveFolderReturn['sharedDriveResults']
  > => {
    const results = await Promise.all(
      sharedDriveQueries.map(async query => {
        return client?.query(
          query.definition(),
          query.options
        ) as Promise<SharedDriveResult>
      })
    )

    return results.map(
      (result: SharedDriveResult) => result.data
    ) as SharedDriveFolderReturn['sharedDriveResults']
  }, [client, sharedDriveQueries])

  useEffect(() => {
    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSharedDriveResults(null)

    const fetch = async (): Promise<void> => {
      const results = await fetchSharedDriveResults()
      if (!cancelled) {
        setSharedDriveResults(results)
      }
    }

    if (client) {
      void fetch()
    }

    return (): void => {
      cancelled = true
    }
  }, [client, fetchSharedDriveResults])

  return {
    sharedDriveResults
  }
}

export { useQueryMultipleSharedDriveFolders }

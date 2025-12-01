import debounce from 'lodash/debounce'
import { useState, useEffect, useMemo } from 'react'

import { useClient } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'
import CozyRealtime from 'cozy-realtime'

import { buildSharedDriveFolderQuery, QueryConfig } from '@/queries'

interface SharedDriveFolderProps {
  driveId: string
  folderId: string
}

interface SharedDriveFolderReturn {
  sharedDriveQuery: QueryConfig
  sharedDriveResult: {
    data?: IOCozyFile[] | null
    included?: IOCozyFile[] | null
  }
}

const useSharedDriveFolder = ({
  driveId,
  folderId
}: SharedDriveFolderProps): SharedDriveFolderReturn => {
  // FIXME: We should use useQuery hook here but it doesn't allow to get included data
  // See https://github.com/cozy/cozy-client/issues/1620

  // const sharedDriveQuery = buildSharedDriveFolderQuery({
  //   driveId,
  //   folderId
  // })
  // const sharedDriveResult = useQuery(
  //   sharedDriveQuery.definition,
  //   sharedDriveQuery.options
  // ) as SharedDriveFolderReturn['sharedDriveResult']

  // return {
  //   sharedDriveQuery,
  //   sharedDriveResult
  // }

  const client = useClient()
  const [sharedDriveResult, setSharedDriveResult] = useState<
    SharedDriveFolderReturn['sharedDriveResult']
  >({ data: undefined })

  const sharedDriveQuery = useMemo(
    () =>
      buildSharedDriveFolderQuery({
        driveId,
        folderId
      }),
    [driveId, folderId]
  )

  useEffect(() => {
    const fetchSharedDriveFolder = async (): Promise<void> => {
      const newSharedDriveResult = (await client?.query(
        sharedDriveQuery.definition(),
        sharedDriveQuery.options
      )) as SharedDriveFolderReturn['sharedDriveResult']

      setSharedDriveResult(newSharedDriveResult)
    }

    if (client) {
      void fetchSharedDriveFolder()
    }

    const debouncedFetch = debounce(() => {
      void fetchSharedDriveFolder()
    }, 500)

    let realtime: CozyRealtime | undefined
    if (client) {
      realtime = new CozyRealtime({ client, sharedDriveId: driveId })
      realtime.subscribe('updated', 'io.cozy.files', debouncedFetch)
      realtime.subscribe('created', 'io.cozy.files', debouncedFetch)
      realtime.subscribe('deleted', 'io.cozy.files', debouncedFetch)
    }

    return () => {
      if (realtime) {
        realtime.stop()
      }
      debouncedFetch.cancel()
    }
  }, [client, driveId, sharedDriveQuery])

  return {
    sharedDriveQuery,
    sharedDriveResult
  }
}

export { useSharedDriveFolder }

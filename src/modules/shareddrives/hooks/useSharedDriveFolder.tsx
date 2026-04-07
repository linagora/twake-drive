import debounce from 'lodash/debounce'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

import { useClient } from 'cozy-client'
import type { IOCozyFile } from 'cozy-client/types/types'
import CozyRealtime from 'cozy-realtime'

import logger from '@/lib/logger'
import { paginatedStatById } from '@/modules/shareddrives/hooks/useSharedDriveFolderHelpers'
import { buildSharedDriveFolderQuery } from '@/queries'
import type { QueryConfig } from '@/queries'

interface SharedDriveFolderProps {
  driveId: string
  folderId: string
}

interface SharedDriveFolderReturn {
  // FIXME: We should use useQuery hook here but it doesn't allow to get included data
  // See https://github.com/cozy/cozy-client/issues/1620
  sharedDriveQuery: QueryConfig
  sharedDriveResult: {
    data?: IOCozyFile[] | null
    included?: IOCozyFile[] | null
  }
  hasMore: boolean
  fetchMore: () => Promise<void>
}

const useSharedDriveFolder = ({
  driveId,
  folderId
}: SharedDriveFolderProps): SharedDriveFolderReturn => {
  const client = useClient()
  const [sharedDriveResult, setSharedDriveResult] = useState<
    SharedDriveFolderReturn['sharedDriveResult']
  >({ data: undefined })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const isFetchingMore = useRef(false)
  const fetchGeneration = useRef(0)

  const sharedDriveQuery = useMemo(
    () =>
      buildSharedDriveFolderQuery({
        driveId,
        folderId
      }),
    [driveId, folderId]
  )

  const statById = useMemo(
    () => paginatedStatById(client, driveId),
    [client, driveId]
  )

  useEffect(() => {
    const fetchSharedDriveFolder = async (): Promise<void> => {
      fetchGeneration.current += 1
      const currentGeneration = fetchGeneration.current

      setSharedDriveResult({ data: undefined, included: undefined })
      nextCursorRef.current = null
      setNextCursor(null)

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { included, nextCursor: cursor } = await statById(folderId)

        if (fetchGeneration.current === currentGeneration) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          setSharedDriveResult({ included })
          nextCursorRef.current = cursor
          setNextCursor(cursor)
        }
      } catch (error) {
        logger.error('Error fetching shared drive folder:', error)
        if (fetchGeneration.current === currentGeneration) {
          setSharedDriveResult({ data: undefined, included: undefined })
          nextCursorRef.current = null
          setNextCursor(null)
        }
      }
    }

    if (client && driveId && folderId) {
      void fetchSharedDriveFolder()
    }

    const debouncedFetch = debounce(() => {
      void fetchSharedDriveFolder()
    }, 500)

    let realtime: CozyRealtime | undefined
    if (client && driveId) {
      realtime = new CozyRealtime({ client, sharedDriveId: driveId })
      realtime.subscribe('updated', 'io.cozy.files', debouncedFetch)
      realtime.subscribe('created', 'io.cozy.files', debouncedFetch)
      realtime.subscribe('deleted', 'io.cozy.files', debouncedFetch)
    }

    return (): void => {
      if (realtime) {
        realtime.stop()
      }
      debouncedFetch.cancel()
    }
  }, [client, driveId, folderId, sharedDriveQuery, statById])

  const fetchMore = useCallback(async (): Promise<void> => {
    if (isFetchingMore.current || !nextCursorRef.current || !client) return

    isFetchingMore.current = true
    const currentGeneration = fetchGeneration.current

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { included, nextCursor: cursor } = await statById(
        folderId,
        nextCursorRef.current
      )

      if (fetchGeneration.current !== currentGeneration) return

      setSharedDriveResult(prev => ({
        ...prev,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        included: [...(prev.included ?? []), ...(included ?? [])]
      }))
      nextCursorRef.current = cursor
      setNextCursor(cursor)
    } catch (error) {
      logger.error('Error fetching more shared drive files:', error)
    } finally {
      isFetchingMore.current = false
    }
  }, [client, folderId, statById])

  const hasMore = !!nextCursor

  return {
    sharedDriveQuery,
    sharedDriveResult,
    hasMore,
    fetchMore
  }
}

export { useSharedDriveFolder }

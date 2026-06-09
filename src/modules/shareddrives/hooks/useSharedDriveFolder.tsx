import debounce from 'lodash/debounce'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

import { useClient } from 'cozy-client'
import type { IOCozyFile } from 'cozy-client/types/types'
import CozyRealtime from 'cozy-realtime'

import { paginatedStatById, type PaginatedStatByIdResult } from '@/lib/files'
import logger from '@/lib/logger'
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
  fetchStatus: 'loading' | 'loaded' | 'failed'
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
  const [fetchStatus, setFetchStatus] =
    useState<SharedDriveFolderReturn['fetchStatus']>('loading')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const nextCursorRef = useRef<string | null>(null)
  const isFetchingMore = useRef(false)
  const fetchGeneration = useRef(0)
  const loadedPagesCount = useRef(0)

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
    const fetchSharedDriveFolder = async (
      pagesToLoad = 1,
      { isRefresh = false }: { isRefresh?: boolean } = {}
    ): Promise<void> => {
      fetchGeneration.current += 1
      const currentGeneration = fetchGeneration.current

      // On a realtime-triggered refresh, keep the current list and cursor on
      // screen and refetch in the background; only swap once the new data
      // arrives. Wiping to a loading state here would replace the list with the
      // loading skeleton on every realtime event and make the view blink while
      // files are being added.
      if (!isRefresh) {
        setSharedDriveResult({ data: undefined, included: undefined })
        setFetchStatus('loading')
        nextCursorRef.current = null
        setNextCursor(null)
        loadedPagesCount.current = 0
      }

      try {
        let allIncluded: IOCozyFile[] = []
        let cursor: string | null = null

        for (let page = 0; page < pagesToLoad; page++) {
          const result: PaginatedStatByIdResult = await statById(
            folderId,
            cursor
          )
          allIncluded = [...allIncluded, ...(result.included ?? [])]
          cursor = result.nextCursor
          if (!result.nextCursor) break
        }

        if (fetchGeneration.current === currentGeneration) {
          setSharedDriveResult({ included: allIncluded })
          setFetchStatus('loaded')
          nextCursorRef.current = cursor
          setNextCursor(cursor)
          loadedPagesCount.current = pagesToLoad
        }
      } catch (error) {
        logger.error('Error fetching shared drive folder:', error)
        // A failed background refresh keeps the data already on screen rather
        // than dropping the user into an error state. But if nothing has loaded
        // yet (a refresh racing the very first load), surface the error instead
        // of leaving the view stuck on the loading skeleton.
        const hasLoadedData = loadedPagesCount.current > 0
        if (
          fetchGeneration.current === currentGeneration &&
          (!isRefresh || !hasLoadedData)
        ) {
          setSharedDriveResult({ data: undefined, included: undefined })
          setFetchStatus('failed')
          nextCursorRef.current = null
          setNextCursor(null)
        }
      }
    }

    if (client && driveId && folderId) {
      void fetchSharedDriveFolder()
    }

    const debouncedFetch = debounce(() => {
      void fetchSharedDriveFolder(Math.max(1, loadedPagesCount.current), {
        isRefresh: true
      })
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
  }, [client, driveId, folderId, statById])

  const fetchMore = useCallback(async (): Promise<void> => {
    if (isFetchingMore.current || !nextCursorRef.current || !client) return

    isFetchingMore.current = true
    const currentGeneration = fetchGeneration.current

    try {
      const { included, nextCursor: cursor } = await statById(
        folderId,
        nextCursorRef.current
      )

      if (fetchGeneration.current !== currentGeneration) return

      setSharedDriveResult(prev => ({
        ...prev,

        included: [...(prev.included ?? []), ...(included ?? [])]
      }))
      nextCursorRef.current = cursor
      setNextCursor(cursor)
      loadedPagesCount.current += 1
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
    fetchStatus,
    hasMore,
    fetchMore
  }
}

export { useSharedDriveFolder }

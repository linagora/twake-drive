import debounce from 'lodash/debounce'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

import { useClient } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'
import CozyRealtime from 'cozy-realtime'

import logger from '@/lib/logger'
import { buildSharedDriveFolderQuery, QueryConfig } from '@/queries'

const PAGE_LIMIT = 100

const parseCursorFromLink = (link: string): string | null => {
  try {
    const queryString = link.split('?')[1]
    if (!queryString) return null
    const params = new URLSearchParams(queryString)
    return params.get('page[cursor]')
  } catch {
    return null
  }
}

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
  hasMore: boolean
  fetchMore: () => Promise<void>
}

const useSharedDriveFolder = ({
  driveId,
  folderId
}: SharedDriveFolderProps): SharedDriveFolderReturn => {
  // FIXME: We should use useQuery hook here but it doesn't allow to get included data
  // See https://github.com/cozy/cozy-client/issues/1620

  const client = useClient()
  const [sharedDriveResult, setSharedDriveResult] = useState<
    SharedDriveFolderReturn['sharedDriveResult']
  >({ data: undefined })
  const [nextCursor, setNextCursor] = useState<string | null>(null)
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

  const getCollection = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return client?.getStackClient().collection('io.cozy.files', { driveId })
  }, [client, driveId])

  useEffect(() => {
    const fetchSharedDriveFolder = async (): Promise<void> => {
      fetchGeneration.current += 1
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const collection = getCollection()
      if (!collection) return

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await collection.statById(folderId, {
        'page[limit]': PAGE_LIMIT
      })

      const typedResult =
        result as SharedDriveFolderReturn['sharedDriveResult'] & {
          links?: { next?: string }
        }

      setSharedDriveResult(typedResult)
      setNextCursor(
        typedResult.links?.next
          ? parseCursorFromLink(typedResult.links.next)
          : null
      )
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
  }, [client, driveId, folderId, sharedDriveQuery, getCollection])

  const fetchMore = useCallback(async (): Promise<void> => {
    if (isFetchingMore.current || !nextCursor || !client) return

    isFetchingMore.current = true
    const currentGeneration = fetchGeneration.current

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const collection = getCollection()
      if (!collection) return

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await collection.statById(folderId, {
        'page[cursor]': nextCursor,
        'page[limit]': PAGE_LIMIT
      })

      // If a realtime refetch happened while we were fetching, discard this result
      if (fetchGeneration.current !== currentGeneration) return

      const typedResult =
        result as SharedDriveFolderReturn['sharedDriveResult'] & {
          links?: { next?: string }
        }

      setSharedDriveResult(prev => ({
        ...prev,
        included: [...(prev.included ?? []), ...(typedResult.included ?? [])]
      }))
      setNextCursor(
        typedResult.links?.next
          ? parseCursorFromLink(typedResult.links.next)
          : null
      )
    } catch (error) {
      logger.error('Error fetching more shared drive files:', error)
    } finally {
      isFetchingMore.current = false
    }
  }, [nextCursor, client, folderId, getCollection])

  const hasMore = !!nextCursor

  return {
    sharedDriveQuery,
    sharedDriveResult,
    hasMore,
    fetchMore
  }
}

export { useSharedDriveFolder }

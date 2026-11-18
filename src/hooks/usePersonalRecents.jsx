import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useClient, useQuery } from 'cozy-client'

import { buildPersonalRecentsQuery } from '@/queries'

const recentsQuery = buildPersonalRecentsQuery()

// Read from the store, so that a loop started before the refresh sees it.
const isRefreshing = client =>
  Boolean(client.getQueryFromState(recentsQuery.options.as)?.isFetching)

// An empty page adds no row, so the end of the list stays in view and the
// scroll does not ask for more again: follow the cursor until a page has some.
// Stops on a refresh, which replaces the pages: a page from the previous
// cursor would be appended after the new first one. Returns whether it ended.
const fetchMoreUntilRows = async (client, fetchMore) => {
  let page
  do {
    if (isRefreshing(client)) return false
    page = await fetchMore()
  } while (page?.next && page.data.length === 0)
  return true
}

const useFetchMoreRecents = ({
  recents,
  hasMore,
  fetchStatus,
  isFetching,
  fetchMore
}) => {
  const client = useClient()
  const isPendingRef = useRef(false)

  // The stack may return an empty page that has a next one: the list stays
  // loading, also while that next page is fetched.
  const hasOnlyEmptyPages = recents.length === 0 && hasMore
  const isIdle = fetchStatus === 'loaded' && !isFetching

  useEffect(() => {
    if (hasOnlyEmptyPages && isIdle) fetchMore()
  }, [hasOnlyEmptyPages, isIdle, fetchMore])

  const fetchMoreRecents = useCallback(async () => {
    isPendingRef.current = !(await fetchMoreUntilRows(client, fetchMore))
  }, [client, fetchMore])

  // Load the pages asked during the refresh, from its cursor.
  useEffect(() => {
    if (isFetching || !isPendingRef.current) return
    isPendingRef.current = false
    fetchMoreRecents()
  }, [isFetching, fetchMoreRecents])

  return {
    isWaitingForNextPage: hasOnlyEmptyPages && fetchStatus !== 'failed',
    fetchMoreRecents
  }
}

/**
 * Personal recents of the stack, in their order (last activity first).
 *
 * Each row is the io.cozy.files document of a recent, read from the store.
 * A recent whose file the user can no longer read is returned as is.
 */
export const usePersonalRecents = ({ enabled = true } = {}) => {
  const {
    data,
    fetchStatus,
    isFetching,
    lastError,
    lastUpdate,
    hasMore,
    fetchMore
  } = useQuery(recentsQuery.definition, { ...recentsQuery.options, enabled })

  const recents = useMemo(() => data ?? [], [data])

  const { isWaitingForNextPage, fetchMoreRecents } = useFetchMoreRecents({
    recents,
    hasMore,
    fetchStatus,
    isFetching,
    fetchMore
  })

  const rows = useMemo(
    () => recents.map(recent => recent.file?.data ?? recent),
    [recents]
  )

  const lastActivityAtById = useMemo(
    () => new Map(recents.map(recent => [recent._id, recent.last_activity_at])),
    [recents]
  )

  const getLastActivityAt = useCallback(
    file => lastActivityAtById.get(file._id) ?? null,
    [lastActivityAtById]
  )

  return {
    data: rows,
    fetchStatus: isWaitingForNextPage ? 'loading' : fetchStatus,
    error: lastError ?? null,
    lastUpdate: isWaitingForNextPage ? null : lastUpdate,
    hasMore,
    fetchMore: fetchMoreRecents,
    getLastActivityAt
  }
}

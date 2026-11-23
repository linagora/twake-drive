import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  visibleCount,
  hasHiddenRows,
  hasMore,
  fetchStatus,
  isFetching,
  fetchMore
}) => {
  const client = useClient()
  const isPendingRef = useRef(false)
  const isLoadingMoreRef = useRef(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [askedAtCount, setAskedAtCount] = useState(null)

  // The stack may return an empty page that has a next one: the list stays
  // loading, also while that next page is fetched.
  const hasOnlyEmptyPages = visibleCount === 0 && hasMore
  const isIdle = fetchStatus === 'loaded' && !isFetching

  useEffect(() => {
    if (hasOnlyEmptyPages && isIdle) fetchMore()
  }, [hasOnlyEmptyPages, isIdle, fetchMore])

  // Only hidden rows need to know when a load ends, to go on after it.
  const loadMore = useCallback(async () => {
    if (hasHiddenRows) {
      if (isLoadingMoreRef.current) return
      isLoadingMoreRef.current = true
      setIsLoadingMore(true)
    }
    try {
      isPendingRef.current = !(await fetchMoreUntilRows(client, fetchMore))
    } finally {
      if (hasHiddenRows) {
        isLoadingMoreRef.current = false
        setIsLoadingMore(false)
      }
    }
  }, [client, fetchMore, hasHiddenRows])

  const fetchMoreRecents = useCallback(async () => {
    if (hasHiddenRows) setAskedAtCount(count => count ?? visibleCount)
    await loadMore()
  }, [hasHiddenRows, visibleCount, loadMore])

  // Load the pages asked during the refresh, from its cursor.
  useEffect(() => {
    if (isFetching || !isPendingRef.current) return
    isPendingRef.current = false
    fetchMoreRecents()
  }, [isFetching, fetchMoreRecents])

  // A page of hidden rows adds nothing to the list, so the end stays in view
  // and nothing asks for more again: go on until a visible row comes.
  useEffect(() => {
    if (askedAtCount === null || isLoadingMore || !isIdle) return
    if (hasOnlyEmptyPages) return
    if (visibleCount > askedAtCount || !hasMore) {
      setAskedAtCount(null)
      return
    }
    loadMore()
  }, [
    askedAtCount,
    isLoadingMore,
    isIdle,
    hasOnlyEmptyPages,
    visibleCount,
    hasMore,
    loadMore
  ])

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
 *
 * `isVisible` keeps only the rows it accepts, and more pages are loaded while
 * they bring none. Pass a stable function: it is a dependency of the rows.
 */
export const usePersonalRecents = ({
  enabled = true,
  isVisible = null
} = {}) => {
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

  const rows = useMemo(() => {
    const files = recents.map(recent => recent.file?.data ?? recent)
    return isVisible ? files.filter(isVisible) : files
  }, [recents, isVisible])

  const { isWaitingForNextPage, fetchMoreRecents } = useFetchMoreRecents({
    visibleCount: rows.length,
    hasHiddenRows: Boolean(isVisible),
    hasMore,
    fetchStatus,
    isFetching,
    fetchMore
  })

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

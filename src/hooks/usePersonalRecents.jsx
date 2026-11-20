import { useCallback, useEffect, useMemo } from 'react'

import { useQuery } from 'cozy-client'

import { buildPersonalRecentsQuery } from '@/queries'

const recentsQuery = buildPersonalRecentsQuery()

/**
 * Personal recents of the stack, in their order (last activity first).
 *
 * Each row is the io.cozy.files document of a recent, read from the store.
 * A recent whose file the user can no longer read is returned as is.
 */
export const usePersonalRecents = ({ enabled = true } = {}) => {
  const { data, fetchStatus, lastError, lastUpdate, hasMore, fetchMore } =
    useQuery(recentsQuery.definition, { ...recentsQuery.options, enabled })

  const recents = useMemo(() => data ?? [], [data])

  // The stack may return an empty page that has a next one: the list stays
  // loading, also while that next page is fetched.
  const hasOnlyEmptyPages = recents.length === 0 && hasMore
  const isWaitingForNextPage = hasOnlyEmptyPages && fetchStatus !== 'failed'

  useEffect(() => {
    if (hasOnlyEmptyPages && fetchStatus === 'loaded') fetchMore()
  }, [hasOnlyEmptyPages, fetchStatus, fetchMore])

  // An empty page adds no row, so the end of the list stays in view and the
  // scroll does not ask for more again: follow the cursor until a page has some.
  const fetchMoreRecents = useCallback(async () => {
    let page
    do {
      page = await fetchMore()
    } while (page?.next && page.data.length === 0)
  }, [fetchMore])

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

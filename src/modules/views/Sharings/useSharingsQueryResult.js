import { useMemo } from 'react'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'

import { buildSharingsQuery } from '@/queries'

export function useSharingsQueryResult(sharedDocumentIds, allLoaded) {
  const query = useMemo(
    () =>
      buildSharingsQuery({
        ids: sharedDocumentIds,
        enabled: allLoaded && sharedDocumentIds?.length > 0
      }),
    [sharedDocumentIds, allLoaded]
  )

  return useQuery(query.definition, query.options)
}

export function getSharingsFetchStatus({
  allLoaded,
  filteredResult,
  sharedDrivesLoaded,
  sharedDrivesError
}) {
  if (filteredResult.fetchStatus === 'failed' || sharedDrivesError) {
    return 'failed'
  }

  return allLoaded && sharedDrivesLoaded && hasQueryBeenLoaded(filteredResult)
    ? 'loaded'
    : 'loading'
}

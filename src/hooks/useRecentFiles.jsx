import React, { useState, useMemo, useCallback } from 'react'

import { useClient, DataProxyLink } from 'cozy-client'

import RecentScopeQuery from '@/hooks/useRecentFiles/RecentScopeQuery'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

const useRecentFiles = () => {
  const client = useClient()
  const { recipientDriveIds } = useSharedDrives()

  const hasDataProxy = useMemo(
    () =>
      Array.isArray(client?.links) &&
      client.links.some(link => link instanceof DataProxyLink),
    [client]
  )

  const driveScopeIds = useMemo(
    () => (hasDataProxy ? recipientDriveIds : []),
    [hasDataProxy, recipientDriveIds]
  )

  const activeScopeKeys = useMemo(
    () => ['recents-own', ...driveScopeIds.map(id => `recents-drive-${id}`)],
    [driveScopeIds]
  )

  const [resultsByScope, setResultsByScope] = useState({})

  const handleResult = useCallback((scopeKey, result) => {
    setResultsByScope(prev => ({ ...prev, [scopeKey]: result }))
  }, [])

  const scopeQueries = useMemo(
    () => [
      <RecentScopeQuery
        key="recents-own"
        scopeKey="recents-own"
        onResult={handleResult}
      />,
      ...driveScopeIds.map(id => (
        <RecentScopeQuery
          key={`recents-drive-${id}`}
          scopeKey={`recents-drive-${id}`}
          driveId={id}
          onResult={handleResult}
        />
      ))
    ],
    [driveScopeIds, handleResult]
  )

  const { data, fetchStatus, error } = useMemo(() => {
    const activeScopeKeysSet = new Set(activeScopeKeys)

    // Filter to only active scopes — pruning stale entries at compute time
    const activeResults = Object.fromEntries(
      Object.entries(resultsByScope).filter(([k]) => activeScopeKeysSet.has(k))
    )

    const allReported = activeScopeKeys.every(k => k in activeResults)

    // Surface own-scope hard errors
    const ownResult = activeResults['recents-own']
    if (ownResult?.fetchStatus === 'error') {
      return { data: [], fetchStatus: 'error', error: ownResult.error }
    }

    // Gather files from all reported active scopes
    const allFiles = Object.values(activeResults).flatMap(r => r?.data || [])

    const nonTrashed = allFiles.filter(f => !f.trashed)

    const sorted = [...nonTrashed].sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    )

    const seen = new Set()
    const deduped = sorted.filter(f => {
      if (seen.has(f._id)) return false
      seen.add(f._id)
      return true
    })

    const capped = deduped.slice(0, 50)

    return {
      data: capped,
      fetchStatus: allReported ? 'loaded' : 'loading',
      error: null
    }
  }, [resultsByScope, activeScopeKeys])

  return { data, fetchStatus, error, scopeQueries }
}

export default useRecentFiles

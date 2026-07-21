import { useEffect, useMemo } from 'react'

import { useQuery } from 'cozy-client'

import { buildRecentsScopedQuery } from '@/queries'

interface RecentResult {
  data: unknown[]
  fetchStatus: string
  error: unknown
}

interface RecentScopeQueryProps {
  driveId?: string
  scopeKey: string
  onResult: (scopeKey: string, result: RecentResult) => void
}

const RecentScopeQuery = ({
  driveId,
  scopeKey,
  onResult
}: RecentScopeQueryProps): null => {
  const q = useMemo(() => buildRecentsScopedQuery({ driveId }), [driveId])
  const r = useQuery(q.definition, q.options)

  useEffect(() => {
    const is403 = (r.error as { status?: number } | null)?.status === 403
    const result: RecentResult = is403
      ? { data: [], fetchStatus: 'loaded', error: null }
      : { data: r.data ?? [], fetchStatus: r.fetchStatus, error: r.error }
    onResult(scopeKey, result)
  }, [r.data, r.fetchStatus, r.error, scopeKey, onResult])

  return null
}

export default RecentScopeQuery

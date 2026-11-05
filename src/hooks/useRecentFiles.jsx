import { useEffect, useState, useMemo } from 'react'

import { useClient } from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'

import logger from '@/lib/logger'
import { buildRecentQuery } from '@/queries'

const useDataProxyRecents = () => {
  const [data, setData] = useState([])
  const [fetchStatus, setFetchStatus] = useState('loading')
  const [error, setError] = useState(null)
  const dataProxy = useDataProxy()
  const client = useClient()

  const recentQuery = useMemo(() => buildRecentQuery(), [])

  useEffect(() => {
    let isCurrent = true
    const fetchRecents = async () => {
      setFetchStatus('loading')
      setError(null)

      if (dataProxy.dataProxyServicesAvailable) {
        try {
          const data = await dataProxy.recents()
          if (!isCurrent) return
          setData(data || [])
          setFetchStatus('loaded')
          return
        } catch (err) {
          if (!isCurrent) return
          logger.error('Error fetching recents from dataproxy', err)
        }
      }

      if (client) {
        try {
          const result = await client.fetchQueryAndGetFromState({
            definition: recentQuery.definition(),
            options: recentQuery.options
          })
          if (!isCurrent) return
          setData(result?.data || [])
          setFetchStatus('loaded')
        } catch (err) {
          if (!isCurrent) return
          logger.warn('Error fetching recents from fallback query', err)
          setError(err)
          setFetchStatus('error')
        }
      } else {
        setError(new Error('Client not available'))
        setFetchStatus('error')
      }
    }

    fetchRecents()
    return () => {
      isCurrent = false
    }
  }, [dataProxy, client, recentQuery])

  return { data, fetchStatus, error }
}

export default useDataProxyRecents

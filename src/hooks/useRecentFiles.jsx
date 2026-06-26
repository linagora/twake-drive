import { useEffect, useState, useMemo } from 'react'

import { useClient, useQuery } from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'

import logger from '@/lib/logger'
import { buildRecentQuery } from '@/queries'

const useDataProxyRecents = () => {
  const [proxyState, setProxyState] = useState({
    data: null,
    fetchStatus: 'loading',
    error: null
  })

  const dataProxy = useDataProxy()
  const client = useClient()

  const recentQuery = useMemo(() => buildRecentQuery(), [])

  // Reactive fallback when proxy is unavailable or fails
  const fallbackResult = useQuery(recentQuery.definition(), recentQuery.options)

  useEffect(() => {
    const fetchProxyRecents = async () => {
      setProxyState({
        data: null,
        fetchStatus: 'loading',
        error: null
      })

      if (dataProxy.dataProxyServicesAvailable) {
        try {
          const data = await dataProxy.recents()
          setProxyState({
            data: data || [],
            fetchStatus: 'loaded',
            error: null
          })
        } catch (err) {
          logger.error('Error fetching recents from dataproxy', err)
          setProxyState({
            data: null,
            fetchStatus: 'error',
            error: err
          })
        }
      }
    }

    if (dataProxy.dataProxyServicesAvailable) {
      fetchProxyRecents()
    }
  }, [dataProxy])

  // Proxy path: merge proxy data with real-time store state
  if (dataProxy.dataProxyServicesAvailable && proxyState.fetchStatus !== 'error') {
    let finalData = []
    if (proxyState.data) {
      finalData = proxyState.data.reduce((acc, file) => {
        const docInStore = client.getDocumentFromState(
          'io.cozy.files',
          file._id
        )
        if (docInStore) {
          if (!docInStore.trashed) {
            acc.push({ ...file, ...docInStore })
          }
        } else if (!file.trashed) {
          acc.push(file)
        }
        return acc
      }, [])
    }

    return {
      data: finalData,
      fetchStatus: proxyState.fetchStatus,
      error: proxyState.error
    }
  }

  // Fallback: use cozy-client query (proxy unavailable or errored)
  if (fallbackResult.error) {
    logger.warn(
      'Error fetching recents from fallback query',
      fallbackResult.error
    )
  }

  return {
    data: fallbackResult.data || [],
    fetchStatus: fallbackResult.error ? 'error' : fallbackResult.fetchStatus,
    error: fallbackResult.error || proxyState.error
  }
}

export default useDataProxyRecents

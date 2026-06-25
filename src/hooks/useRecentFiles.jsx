import { useEffect, useState, useMemo } from 'react'

import { useClient, useQuery } from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'

import logger from '@/lib/logger'
import { buildRecentQuery } from '@/queries'

const useDataProxyRecents = () => {
  const [proxyData, setProxyData] = useState(null)
  const [proxyFetchStatus, setProxyFetchStatus] = useState('loading')
  const [proxyError, setProxyError] = useState(null)

  const dataProxy = useDataProxy()
  const client = useClient()

  const recentQuery = useMemo(() => buildRecentQuery(), [])

  // Reactive fallback when proxy is unavailable or fails
  const fallbackResult = useQuery(recentQuery.definition(), recentQuery.options)

  useEffect(() => {
    const fetchProxyRecents = async () => {
      setProxyFetchStatus('loading')
      setProxyError(null)

      if (dataProxy.dataProxyServicesAvailable) {
        try {
          const data = await dataProxy.recents()
          setProxyData(data || [])
          setProxyFetchStatus('loaded')
        } catch (err) {
          logger.error('Error fetching recents from dataproxy', err)
          setProxyError(err)
          setProxyFetchStatus('error')
        }
      }
    }

    if (dataProxy.dataProxyServicesAvailable) {
      fetchProxyRecents()
    }
  }, [dataProxy])

  if (!client) {
    return {
      data: [],
      fetchStatus: 'error',
      error: new Error('Client not available')
    }
  }

  // Proxy path: merge proxy data with real-time store state
  if (dataProxy.dataProxyServicesAvailable && proxyFetchStatus !== 'error') {
    let finalData = []
    if (proxyData) {
      finalData = proxyData.reduce((acc, file) => {
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
      fetchStatus: proxyFetchStatus,
      error: proxyError
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
    error: fallbackResult.error || proxyError
  }
}

export default useDataProxyRecents

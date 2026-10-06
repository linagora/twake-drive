import { useState, useEffect } from 'react'

import { useClient } from 'cozy-client'

const pendingFetches = new WeakMap()

const fetchSharedDrivesOnce = client => {
  if (!pendingFetches.has(client)) {
    const request = client
      .collection('io.cozy.sharings')
      .fetchSharedDrives()
      .finally(() => pendingFetches.delete(client))
    pendingFetches.set(client, request)
  }
  return pendingFetches.get(client)
}

export const useSharedDrives = () => {
  const client = useClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [sharedDrives, setSharedDrives] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let isCancelled = false
    let requestGeneration = 0

    const fetchSharedDrives = async ({ shared = false } = {}) => {
      const currentRequestGeneration = ++requestGeneration
      setIsLoading(true)
      setError(null)
      try {
        const { data: sharedDrives } = shared
          ? await fetchSharedDrivesOnce(client)
          : await client.collection('io.cozy.sharings').fetchSharedDrives()

        if (!isCancelled && currentRequestGeneration === requestGeneration) {
          setSharedDrives(sharedDrives)
        }
      } catch (error) {
        if (!isCancelled && currentRequestGeneration === requestGeneration) {
          setError(error)
        }
      } finally {
        if (!isCancelled && currentRequestGeneration === requestGeneration) {
          setIsLoading(false)
          setIsLoaded(true)
        }
      }
    }

    const handleRealtimeChange = doc => {
      if (doc.drive) {
        void fetchSharedDrives()
      }
    }

    void fetchSharedDrives({ shared: true })

    const { realtime } = client.plugins || {}

    if (realtime) {
      realtime.subscribe('created', 'io.cozy.sharings', handleRealtimeChange)
      realtime.subscribe('updated', 'io.cozy.sharings', handleRealtimeChange)
      realtime.subscribe('deleted', 'io.cozy.sharings', handleRealtimeChange)
    }

    return () => {
      isCancelled = true
      if (realtime) {
        realtime.unsubscribe(
          'created',
          'io.cozy.sharings',
          handleRealtimeChange
        )
        realtime.unsubscribe(
          'updated',
          'io.cozy.sharings',
          handleRealtimeChange
        )
        realtime.unsubscribe(
          'deleted',
          'io.cozy.sharings',
          handleRealtimeChange
        )
      }
    }
  }, [client])

  return { isLoading, isLoaded, sharedDrives, error }
}

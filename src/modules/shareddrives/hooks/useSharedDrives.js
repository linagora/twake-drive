import { useState, useEffect } from 'react'

import { useClient } from 'cozy-client'

export const useSharedDrives = () => {
  const client = useClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [sharedDrives, setSharedDrives] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let isCancelled = false
    let requestGeneration = 0

    const fetchSharedDrives = async () => {
      const currentRequestGeneration = ++requestGeneration
      setIsLoading(true)
      setError(null)
      try {
        const { data: sharedDrives } = await client
          .collection('io.cozy.sharings')
          .fetchSharedDrives()

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

    void fetchSharedDrives()

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

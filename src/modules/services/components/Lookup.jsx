import { useEffect } from 'react'

import { useClient } from 'cozy-client'

import { lookupReferencedFiles } from '@/modules/services/lookupReferences'

export function Lookup({ service }) {
  const client = useClient()

  useEffect(() => {
    let isActive = true

    const startLookup = async () => {
      try {
        // Let React's effect cleanup cancel a discarded mount before any I/O.
        await Promise.resolve()
        if (!isActive) return
        const result = await lookupReferencedFiles(client, service.getData())
        if (isActive) service.terminate(result)
      } catch (error) {
        // A new error: the one of a request may hold its `Response`, which
        // postMessage cannot clone
        if (isActive) service.throw(new Error(error?.message || String(error)))
      }
    }

    startLookup()
    return () => {
      isActive = false
    }
  }, [client, service])

  return null
}

import { useEffect } from 'react'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { ensureProvisionedAssistants } from 'cozy-search'

import logger from '@/lib/logger'

export const AUTOPROVISION_FLAG = 'rag.assistants.autoprovision'

// Once per session: the provisioning is idempotent but not free.
let started = false

export const resetAutoprovisionForTests = () => {
  started = false
}

/**
 * Provisions the assistants described by the rag.assistants.autoprovision
 * flag (see cozy-search). Runs once per session, never blocks rendering.
 */
export const useAutoprovisionAssistants = () => {
  const client = useClient()

  useEffect(() => {
    if (started || !client) return
    const entries = flag(AUTOPROVISION_FLAG)
    if (!Array.isArray(entries) || entries.length === 0) return
    started = true
    ensureProvisionedAssistants(client, entries)
      .then(result => {
        if (result.skipped.length > 0) {
          logger.warn('assistants autoprovision: skipped', result.skipped)
        }
        return undefined
      })
      .catch(error => {
        logger.warn('assistants autoprovision failed', error)
      })
  }, [client])
}

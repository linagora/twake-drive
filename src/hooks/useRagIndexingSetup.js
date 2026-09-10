import { useEffect } from 'react'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { ensureProvisionedAssistants, setupRagIndexing } from 'cozy-search'

import logger from '@/lib/logger'

export const AUTOPROVISION_FLAG = 'rag.assistants.autoprovision'

// Once per session: both steps are idempotent but not free.
let started = false

export const resetRagIndexingSetupForTests = () => {
  started = false
}

const run = async client => {
  const setup = await setupRagIndexing(client)
  if (setup.errors.length > 0) {
    logger.warn('rag indexing setup: errors', setup.errors)
  }
  const entries = flag(AUTOPROVISION_FLAG)
  if (!Array.isArray(entries) || entries.length === 0) return
  const result = await ensureProvisionedAssistants(client, entries)
  if (result.skipped.length > 0) {
    logger.warn('assistants autoprovision: skipped', result.skipped)
  }
}

/**
 * Prepares the assistants-driven RAG indexing (see cozy-search's
 * setupRagIndexing), then provisions the assistants described by the
 * rag.assistants.autoprovision flag. Runs once per session, never blocks
 * rendering.
 */
export const useRagIndexingSetup = () => {
  const client = useClient()

  useEffect(() => {
    if (started || !client) return
    started = true
    run(client).catch(error => {
      logger.warn('rag indexing setup failed', error)
    })
  }, [client])
}

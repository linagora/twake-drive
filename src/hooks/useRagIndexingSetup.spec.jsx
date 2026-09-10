import { renderHook } from '@testing-library/react'

import flag from 'cozy-flags'
import { ensureProvisionedAssistants, setupRagIndexing } from 'cozy-search'

import {
  resetRagIndexingSetupForTests,
  useRagIndexingSetup
} from './useRagIndexingSetup'

import logger from '@/lib/logger'

jest.mock('cozy-flags', () => jest.fn())
jest.mock('cozy-client', () => ({ useClient: () => ({ id: 'client' }) }))
jest.mock('cozy-search', () => ({
  ensureProvisionedAssistants: jest.fn(),
  setupRagIndexing: jest.fn()
}))
jest.mock('@/lib/logger', () => ({
  warn: jest.fn(),
  error: jest.fn()
}))

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useRagIndexingSetup', () => {
  beforeEach(() => {
    resetRagIndexingSetupForTests()
    flag.mockReset()
    logger.warn.mockReset()
    setupRagIndexing
      .mockReset()
      .mockResolvedValue({ triggers: [], migrated: [], errors: [] })
    ensureProvisionedAssistants
      .mockReset()
      .mockResolvedValue({ created: [], ensured: [], skipped: [] })
  })

  it('sets up the indexing once per session, without the flag', async () => {
    flag.mockReturnValue(null)
    const { rerender } = renderHook(() => useRagIndexingSetup())
    rerender()
    renderHook(() => useRagIndexingSetup())
    await flush()

    expect(setupRagIndexing).toHaveBeenCalledTimes(1)
    expect(setupRagIndexing).toHaveBeenCalledWith({ id: 'client' })
    expect(ensureProvisionedAssistants).not.toHaveBeenCalled()
  })

  it('provisions after the setup with the flag entries', async () => {
    const entries = [{ name: 'Docs', dirName: 'Docs' }]
    flag.mockImplementation(name =>
      name === 'rag.assistants.autoprovision' ? entries : null
    )
    renderHook(() => useRagIndexingSetup())
    await flush()

    expect(setupRagIndexing).toHaveBeenCalledTimes(1)
    expect(ensureProvisionedAssistants).toHaveBeenCalledTimes(1)
    expect(ensureProvisionedAssistants).toHaveBeenCalledWith(
      { id: 'client' },
      entries
    )
    expect(setupRagIndexing.mock.invocationCallOrder[0]).toBeLessThan(
      ensureProvisionedAssistants.mock.invocationCallOrder[0]
    )
  })

  it('still provisions when the setup reported errors', async () => {
    flag.mockReturnValue([{ name: 'Docs', dirName: 'Docs' }])
    setupRagIndexing.mockResolvedValue({
      triggers: [],
      migrated: [],
      errors: [new Error('forbidden')]
    })
    renderHook(() => useRagIndexingSetup())
    await flush()

    expect(logger.warn).toHaveBeenCalledWith(
      'rag indexing setup: errors',
      expect.any(Array)
    )
    expect(ensureProvisionedAssistants).toHaveBeenCalledTimes(1)
  })

  it('logs skipped provisioning entries', async () => {
    flag.mockReturnValue([{ name: 'Docs', dirName: 'Docs' }])
    ensureProvisionedAssistants.mockResolvedValue({
      created: [],
      ensured: [],
      skipped: [{ id: 'docs', reason: 'nope' }]
    })
    renderHook(() => useRagIndexingSetup())
    await flush()

    expect(logger.warn).toHaveBeenCalledWith(
      'assistants autoprovision: skipped',
      [{ id: 'docs', reason: 'nope' }]
    )
  })

  it('swallows failures', async () => {
    flag.mockReturnValue([{ name: 'Docs', dirName: 'Docs' }])
    setupRagIndexing.mockRejectedValue(new Error('boom'))
    renderHook(() => useRagIndexingSetup())
    await flush()

    expect(logger.warn).toHaveBeenCalledWith(
      'rag indexing setup failed',
      expect.any(Error)
    )
  })
})

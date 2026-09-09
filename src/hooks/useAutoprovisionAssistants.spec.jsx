import { renderHook } from '@testing-library/react'

import flag from 'cozy-flags'
import { ensureProvisionedAssistants } from 'cozy-search'

import {
  resetAutoprovisionForTests,
  useAutoprovisionAssistants
} from './useAutoprovisionAssistants'

import logger from '@/lib/logger'

jest.mock('cozy-flags', () => jest.fn())
jest.mock('cozy-client', () => ({ useClient: () => ({ id: 'client' }) }))
jest.mock('cozy-search', () => ({ ensureProvisionedAssistants: jest.fn() }))
jest.mock('@/lib/logger', () => ({
  warn: jest.fn(),
  error: jest.fn()
}))

describe('useAutoprovisionAssistants', () => {
  beforeEach(() => {
    resetAutoprovisionForTests()
    flag.mockReset()
    logger.warn.mockReset()
    ensureProvisionedAssistants.mockReset().mockResolvedValue({
      created: [],
      ensured: [],
      skipped: []
    })
  })

  it('does nothing without the flag', () => {
    flag.mockReturnValue(null)
    renderHook(() => useAutoprovisionAssistants())
    expect(ensureProvisionedAssistants).not.toHaveBeenCalled()
  })

  it('provisions once per session with the flag entries', () => {
    const entries = [{ name: 'Docs', dirName: 'Docs' }]
    flag.mockImplementation(name =>
      name === 'rag.assistants.autoprovision' ? entries : null
    )

    const { rerender } = renderHook(() => useAutoprovisionAssistants())
    rerender()
    renderHook(() => useAutoprovisionAssistants())

    expect(ensureProvisionedAssistants).toHaveBeenCalledTimes(1)
    expect(ensureProvisionedAssistants).toHaveBeenCalledWith(
      { id: 'client' },
      entries
    )
  })

  it('swallows provisioning errors', async () => {
    flag.mockReturnValue([{ name: 'Docs', dirName: 'Docs' }])
    ensureProvisionedAssistants.mockRejectedValue(new Error('boom'))

    renderHook(() => useAutoprovisionAssistants())
    await Promise.resolve()
    await Promise.resolve()

    expect(logger.warn).toHaveBeenCalled()
  })
})

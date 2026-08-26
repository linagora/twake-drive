import { renderHook, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'

import { useSharedDrives } from './useSharedDrives'

jest.mock('cozy-client', () => ({ useClient: jest.fn() }))

describe('useSharedDrives', () => {
  afterEach(() => jest.clearAllMocks())

  it('exposes loading failures after the request settles', async () => {
    const error = new Error('shared drives failed')
    useClient.mockReturnValue({
      collection: () => ({
        fetchSharedDrives: jest.fn().mockRejectedValue(error)
      }),
      plugins: {}
    })

    const { result } = renderHook(() => useSharedDrives())

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(error)
    expect(result.current.sharedDrives).toEqual([])
  })
})

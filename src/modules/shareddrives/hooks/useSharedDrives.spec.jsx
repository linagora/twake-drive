import { act, renderHook, waitFor } from '@testing-library/react'

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

  it('ignores errors from superseded requests', async () => {
    const requests = []
    const realtime = { subscribe: jest.fn(), unsubscribe: jest.fn() }
    const client = {
      collection: () => ({
        fetchSharedDrives: jest.fn(
          () =>
            new Promise((resolve, reject) => {
              requests.push({ resolve, reject })
            })
        )
      }),
      plugins: { realtime }
    }
    useClient.mockReturnValue(client)

    const { result } = renderHook(() => useSharedDrives())
    const handleRealtimeChange = realtime.subscribe.mock.calls[0][2]

    await act(async () => {
      handleRealtimeChange({ drive: true })
    })
    await act(async () => {
      requests[0].reject(new Error('superseded request failed'))
      await Promise.resolve()
    })

    expect(result.current.error).toBe(null)

    await act(async () => {
      requests[1].resolve({ data: [{ _id: 'drive-1' }] })
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.isLoaded).toBe(true))
    expect(result.current.error).toBe(null)
    expect(result.current.sharedDrives).toEqual([{ _id: 'drive-1' }])
  })
})

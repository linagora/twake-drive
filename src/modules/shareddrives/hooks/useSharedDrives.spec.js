import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import { useSharedDrives } from './useSharedDrives'
import AppLike from 'test/components/AppLike'

const buildMockClient = (sharedDrivesData = []) => {
  const client = createMockClient({})
  client.collection = jest.fn().mockReturnValue({
    fetchSharedDrives: jest.fn().mockResolvedValue({ data: sharedDrivesData })
  })
  client.plugins = {}
  return client
}

const wrapper =
  client =>
  ({ children }) =>
    React.createElement(AppLike, { client }, children)

describe('useSharedDrives', () => {
  describe('recipientDriveIds', () => {
    it('includes drives with owner === false', async () => {
      const client = buildMockClient([{ _id: 'd1', owner: false }])

      const { result } = renderHook(() => useSharedDrives(), {
        wrapper: wrapper(client)
      })

      await waitFor(() => expect(result.current.isLoaded).toBe(true))

      expect(result.current.recipientDriveIds).toContain('d1')
    })

    it('includes drives with owner === undefined (field absent)', async () => {
      const client = buildMockClient([{ _id: 'd2' }])

      const { result } = renderHook(() => useSharedDrives(), {
        wrapper: wrapper(client)
      })

      await waitFor(() => expect(result.current.isLoaded).toBe(true))

      expect(result.current.recipientDriveIds).toContain('d2')
    })

    it('excludes drives with owner === true', async () => {
      const client = buildMockClient([{ _id: 'd3', owner: true }])

      const { result } = renderHook(() => useSharedDrives(), {
        wrapper: wrapper(client)
      })

      await waitFor(() => expect(result.current.isLoaded).toBe(true))

      expect(result.current.recipientDriveIds).not.toContain('d3')
    })

    it('returns only recipient ids when drives have mixed ownership', async () => {
      const client = buildMockClient([
        { _id: 'owned', owner: true },
        { _id: 'recipient-explicit', owner: false },
        { _id: 'recipient-implicit' }
      ])

      const { result } = renderHook(() => useSharedDrives(), {
        wrapper: wrapper(client)
      })

      await waitFor(() => expect(result.current.isLoaded).toBe(true))

      expect(result.current.recipientDriveIds).toEqual([
        'recipient-explicit',
        'recipient-implicit'
      ])
    })

    it('still exposes sharedDrives, isLoading, isLoaded (additive change)', async () => {
      const client = buildMockClient([{ _id: 'd1', owner: false }])

      const { result } = renderHook(() => useSharedDrives(), {
        wrapper: wrapper(client)
      })

      await waitFor(() => expect(result.current.isLoaded).toBe(true))

      expect(result.current.sharedDrives).toBeDefined()
      expect(typeof result.current.isLoading).toBe('boolean')
      expect(typeof result.current.isLoaded).toBe('boolean')
    })
  })
})

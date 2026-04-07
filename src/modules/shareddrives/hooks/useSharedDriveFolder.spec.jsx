import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import CozyRealtime from 'cozy-realtime'

import { useSharedDriveFolder } from './useSharedDriveFolder'
import AppLike from 'test/components/AppLike'

import logger from '@/lib/logger'

jest.mock('cozy-realtime', () => {
  return jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    stop: jest.fn()
  }))
})

jest.mock('lodash/debounce', () =>
  jest.fn(fn => {
    const immediate = (...args) => fn(...args)
    immediate.cancel = jest.fn()
    return immediate
  })
)

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn()
  }
}))

describe('useSharedDriveFolder', () => {
  const mockDriveId = 'drive-id-1'
  const mockFolderId = 'folder-id-1'
  const mockData = [
    { _id: '1', name: 'file-1.txt', type: 'file' },
    { _id: '2', name: 'file-2.txt', type: 'file' }
  ]

  const makeMockClient = statByIdFn => {
    const mockClient = createMockClient({})
    mockClient.getStackClient = () => ({
      collection: () => ({
        statById: statByIdFn
      })
    })
    return mockClient
  }

  const setup = mockClient => {
    const wrapper = ({ children }) => (
      <AppLike client={mockClient}>{children}</AppLike>
    )

    return renderHook(
      () =>
        useSharedDriveFolder({ driveId: mockDriveId, folderId: mockFolderId }),
      { wrapper }
    )
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch initial data', async () => {
    const statByIdMock = jest.fn().mockResolvedValue({
      included: mockData,
      links: {}
    })
    const mockClient = makeMockClient(statByIdMock)

    const { result } = setup(mockClient)

    expect(result.current.sharedDriveResult.data).toBeUndefined()

    await waitFor(() => {
      expect(result.current.sharedDriveResult.included).toEqual(mockData)
    })

    expect(result.current.hasMore).toBe(false)
  })

  it('should indicate when there is more data to fetch', async () => {
    const cursor = 'next-page-cursor'
    const statByIdMock = jest.fn().mockResolvedValue({
      included: mockData,
      links: {
        next: `/relative/link?page[cursor]=${cursor}&other=params`
      }
    })
    const mockClient = makeMockClient(statByIdMock)

    const { result } = setup(mockClient)

    await waitFor(() => {
      expect(result.current.hasMore).toBe(true)
    })
  })

  it('should fetch more data when fetchMore is called', async () => {
    const cursor = 'next-page-cursor'
    const nextPageData = [
      { _id: '3', name: 'file-3.txt', type: 'file' },
      { _id: '4', name: 'file-4.txt', type: 'file' }
    ]

    const statByIdMock = jest
      .fn()
      .mockResolvedValueOnce({
        included: mockData,
        links: { next: `/relative/link?page[cursor]=${cursor}` }
      })
      .mockResolvedValueOnce({
        included: nextPageData,
        links: {}
      })
    const mockClient = makeMockClient(statByIdMock)

    const { result } = setup(mockClient)

    await waitFor(() => expect(result.current.hasMore).toBe(true))

    await act(() => result.current.fetchMore())

    expect(statByIdMock).toHaveBeenLastCalledWith(mockFolderId, {
      'page[cursor]': cursor,
      'page[limit]': 100
    })

    await waitFor(() => {
      expect(result.current.sharedDriveResult.included).toEqual([
        ...mockData,
        ...nextPageData
      ])
    })

    expect(result.current.hasMore).toBe(false)
  })

  it('should handle empty response', async () => {
    const statByIdMock = jest.fn().mockResolvedValue({
      included: [],
      links: {}
    })
    const mockClient = makeMockClient(statByIdMock)

    const { result } = setup(mockClient)

    await waitFor(() => {
      expect(result.current.sharedDriveResult.included).toEqual([])
    })

    expect(result.current.hasMore).toBe(false)
  })

  it('should handle errors during fetchMore and keep existing data', async () => {
    const cursor = 'next-page-cursor'
    const statByIdMock = jest
      .fn()
      .mockResolvedValueOnce({
        included: mockData,
        links: { next: `/relative/link?page[cursor]=${cursor}` }
      })
      .mockRejectedValueOnce(new Error('Network error'))
    const mockClient = makeMockClient(statByIdMock)

    const { result } = setup(mockClient)

    await waitFor(() => expect(result.current.hasMore).toBe(true))

    await act(() => result.current.fetchMore())

    expect(result.current.sharedDriveResult.included).toEqual(mockData)
    expect(result.current.hasMore).toBe(true)
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching more shared drive files:',
      expect.any(Error)
    )
  })

  it('should not fetch more if already fetching', async () => {
    const cursor = 'next-page-cursor'
    const statByIdMock = jest.fn().mockResolvedValue({
      included: mockData,
      links: { next: `/relative/link?page[cursor]=${cursor}` }
    })
    const mockClient = makeMockClient(statByIdMock)

    const { result } = setup(mockClient)

    await waitFor(() => expect(result.current.hasMore).toBe(true))

    await act(async () => {
      const fetchPromise = result.current.fetchMore()
      await result.current.fetchMore()
      await fetchPromise
    })

    expect(statByIdMock).toHaveBeenCalledTimes(2)
  })

  describe('realtime re-fetch', () => {
    let triggerRealtimeEvent

    beforeEach(() => {
      CozyRealtime.mockImplementation(() => ({
        subscribe: jest.fn((_event, _doctype, callback) => {
          triggerRealtimeEvent = callback
        }),
        stop: jest.fn()
      }))
    })

    it('should re-fetch only page 1 when realtime fires before any fetchMore', async () => {
      const cursor = 'cursor-page-2'
      const page1 = [{ _id: '1', name: 'file-1.txt', type: 'file' }]
      const refreshedPage1 = [
        { _id: '1', name: 'file-1-renamed.txt', type: 'file' }
      ]

      const statByIdMock = jest
        .fn()
        .mockResolvedValueOnce({
          included: page1,
          links: { next: `/link?page[cursor]=${cursor}` }
        })
        .mockResolvedValueOnce({
          included: refreshedPage1,
          links: { next: `/link?page[cursor]=${cursor}` }
        })
      const mockClient = makeMockClient(statByIdMock)
      const { result } = setup(mockClient)

      await waitFor(() =>
        expect(result.current.sharedDriveResult.included).toEqual(page1)
      )
      expect(statByIdMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        triggerRealtimeEvent()
      })

      await waitFor(() =>
        expect(result.current.sharedDriveResult.included).toEqual(
          refreshedPage1
        )
      )
      // 1 initial + 1 re-fetch (page 1 only)
      expect(statByIdMock).toHaveBeenCalledTimes(2)
    })

    it('should re-fetch all loaded pages when realtime fires after fetchMore', async () => {
      const cursor1 = 'cursor-page-2'
      const cursor2 = 'cursor-page-3'

      const page1 = [{ _id: '1', name: 'file-1.txt', type: 'file' }]
      const page2 = [{ _id: '2', name: 'file-2.txt', type: 'file' }]
      const page3 = [{ _id: '3', name: 'file-3.txt', type: 'file' }]
      const refreshedPage1 = [
        { _id: '1', name: 'file-1-renamed.txt', type: 'file' }
      ]
      const refreshedPage2 = [{ _id: '2', name: 'file-2.txt', type: 'file' }]
      const refreshedPage3 = [{ _id: '3', name: 'file-3.txt', type: 'file' }]

      const statByIdMock = jest
        .fn()
        // Initial fetch: page 1
        .mockResolvedValueOnce({
          included: page1,
          links: { next: `/link?page[cursor]=${cursor1}` }
        })
        // fetchMore: page 2
        .mockResolvedValueOnce({
          included: page2,
          links: { next: `/link?page[cursor]=${cursor2}` }
        })
        // fetchMore: page 3
        .mockResolvedValueOnce({ included: page3, links: {} })
        // Realtime re-fetch: page 1
        .mockResolvedValueOnce({
          included: refreshedPage1,
          links: { next: `/link?page[cursor]=${cursor1}` }
        })
        // Realtime re-fetch: page 2
        .mockResolvedValueOnce({
          included: refreshedPage2,
          links: { next: `/link?page[cursor]=${cursor2}` }
        })
        // Realtime re-fetch: page 3
        .mockResolvedValueOnce({ included: refreshedPage3, links: {} })

      const mockClient = makeMockClient(statByIdMock)
      const { result } = setup(mockClient)

      await waitFor(() => expect(result.current.hasMore).toBe(true))

      await act(() => result.current.fetchMore())
      await act(() => result.current.fetchMore())

      await waitFor(() =>
        expect(result.current.sharedDriveResult.included).toEqual([
          ...page1,
          ...page2,
          ...page3
        ])
      )
      expect(statByIdMock).toHaveBeenCalledTimes(3)

      await act(async () => {
        triggerRealtimeEvent()
      })

      await waitFor(() =>
        expect(result.current.sharedDriveResult.included).toEqual([
          ...refreshedPage1,
          ...refreshedPage2,
          ...refreshedPage3
        ])
      )
      // 3 initial + 3 re-fetch (all pages)
      expect(statByIdMock).toHaveBeenCalledTimes(6)
    })
  })
})

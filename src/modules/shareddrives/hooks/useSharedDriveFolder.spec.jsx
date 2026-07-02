import { renderHook } from '@testing-library/react'
import React from 'react'

import { useQuery, createMockClient } from 'cozy-client'

import { useSharedDriveFolder } from './useSharedDriveFolder'
import AppLike from 'test/components/AppLike'

import { useFolderSort } from '@/hooks'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))

jest.mock('@/hooks', () => ({
  ...jest.requireActual('@/hooks'),
  useFolderSort: jest.fn()
}))

// Ensure the legacy machinery is gone from the module source
jest.mock('cozy-realtime', () => {
  throw new Error('cozy-realtime must not be imported by useSharedDriveFolder')
})

describe('useSharedDriveFolder', () => {
  const mockDriveId = 'drive-id-1'
  const mockFolderId = 'folder-id-1'
  const mockData = [
    { _id: '1', name: 'file-1.txt', type: 'file' },
    { _id: '2', name: 'file-2.txt', type: 'file' }
  ]

  const defaultQueryResult = {
    data: mockData,
    fetchStatus: 'loaded',
    lastUpdate: 1234567890,
    hasMore: false,
    fetchMore: jest.fn()
  }

  beforeEach(() => {
    useFolderSort.mockReturnValue([
      { attribute: 'name', order: 'asc' },
      jest.fn(),
      true
    ])
    useQuery.mockReturnValue(defaultQueryResult)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const setup = () => {
    const mockClient = createMockClient({})
    const wrapper = ({ children }) => (
      <AppLike client={mockClient}>{children}</AppLike>
    )
    return renderHook(
      () =>
        useSharedDriveFolder({ driveId: mockDriveId, folderId: mockFolderId }),
      { wrapper }
    )
  }

  it('exposes children via sharedDriveResult.data when useQuery returns data', () => {
    const { result } = setup()
    expect(result.current.sharedDriveResult.data).toEqual(mockData)
  })

  it('exposes null sharedDriveResult.data when useQuery returns null', () => {
    useQuery.mockReturnValue({ ...defaultQueryResult, data: null })
    const { result } = setup()
    expect(result.current.sharedDriveResult.data).toBeNull()
  })

  it('delegates fetchMore to query.fetchMore', () => {
    const mockFetchMore = jest.fn()
    useQuery.mockReturnValue({
      ...defaultQueryResult,
      fetchMore: mockFetchMore
    })
    const { result } = setup()
    result.current.fetchMore()
    expect(mockFetchMore).toHaveBeenCalledTimes(1)
  })

  it('reflects hasMore: true from useQuery', () => {
    useQuery.mockReturnValue({ ...defaultQueryResult, hasMore: true })
    const { result } = setup()
    expect(result.current.hasMore).toBe(true)
  })

  it('reflects hasMore: false from useQuery', () => {
    useQuery.mockReturnValue({ ...defaultQueryResult, hasMore: false })
    const { result } = setup()
    expect(result.current.hasMore).toBe(false)
  })

  it('passes fetchStatus through from useQuery', () => {
    useQuery.mockReturnValue({ ...defaultQueryResult, fetchStatus: 'loading' })
    const { result } = setup()
    expect(result.current.fetchStatus).toBe('loading')
  })

  it('passes lastUpdate through from useQuery', () => {
    useQuery.mockReturnValue({ ...defaultQueryResult, lastUpdate: 9999 })
    const { result } = setup()
    expect(result.current.lastUpdate).toBe(9999)
  })

  const expectQueryEnabled = (isSettingsLoaded, expectedEnabled) => {
    useFolderSort.mockReturnValue([
      { attribute: 'name', order: 'asc' },
      jest.fn(),
      isSettingsLoaded
    ])
    setup()
    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ enabled: expectedEnabled })
    )
  }

  it('gates the query on isSettingsLoaded via enabled option', () => {
    expectQueryEnabled(false, false)
  })

  it('enables the query when isSettingsLoaded is true and params are present', () => {
    expectQueryEnabled(true, true)
  })

  it('sets forceLink dataproxy in the query options', () => {
    setup()
    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ forceLink: 'dataproxy' })
    )
  })

  describe('fetchStatus while sort settings load', () => {
    it('returns "loading" (not "pending") when isSettingsLoaded is false', () => {
      useFolderSort.mockReturnValue([
        { attribute: 'name', order: 'asc' },
        jest.fn(),
        false // settings not yet loaded
      ])
      // useQuery returns 'pending' when the query is gated off via enabled: false
      useQuery.mockReturnValue({
        ...defaultQueryResult,
        fetchStatus: 'pending',
        lastUpdate: undefined
      })
      const { result } = setup()
      expect(result.current.fetchStatus).toBe('loading')
      expect(result.current.lastUpdate).toBeFalsy()
    })

    it('passes through query.fetchStatus when isSettingsLoaded is true', () => {
      useFolderSort.mockReturnValue([
        { attribute: 'name', order: 'asc' },
        jest.fn(),
        true
      ])
      useQuery.mockReturnValue({ ...defaultQueryResult, fetchStatus: 'loaded' })
      const { result } = setup()
      expect(result.current.fetchStatus).toBe('loaded')
    })
  })
})

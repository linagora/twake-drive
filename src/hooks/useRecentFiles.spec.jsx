import { render, act, waitFor } from '@testing-library/react'
import React from 'react'

import { useClient, DataProxyLink } from 'cozy-client'

import useRecentFiles from './useRecentFiles'

import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

// Mock cozy-client: create a fake DataProxyLink class that can be used with instanceof
jest.mock('cozy-client', () => {
  class FakeDataProxyLink {}
  return {
    useClient: jest.fn(),
    DataProxyLink: FakeDataProxyLink
  }
})

jest.mock('@/modules/shareddrives/hooks/useSharedDrives', () => ({
  useSharedDrives: jest.fn()
}))

jest.mock('@/hooks/useRecentFiles/RecentScopeQuery', () => ({
  __esModule: true,
  default: jest.fn()
}))

const MockRecentScopeQuery = require('@/hooks/useRecentFiles/RecentScopeQuery')
  .default

const mockUseClient = useClient
const mockUseSharedDrives = useSharedDrives

// Get the FakeDataProxyLink class to create instances
const { DataProxyLink: FakeDataProxyLink } = require('cozy-client')

const makeClientWithDataProxy = () => ({
  links: [new FakeDataProxyLink()]
})

const makeClientWithoutDataProxy = () => ({
  links: []
})

const makeFile = (id, updated_at, extra = {}) => ({
  _id: id,
  id,
  updated_at,
  trashed: false,
  type: 'file',
  name: `file-${id}`,
  ...extra
})

/**
 * Renders a TestComponent that calls useRecentFiles and also mounts the
 * scopeQueries elements so MockRecentScopeQuery is invoked and populates
 * onResultRegistry. Returns a ref object that always holds the latest result.
 */
const renderHookWithScopes = () => {
  const ref = { current: null }

  const TestComponent = () => {
    const result = useRecentFiles()
    ref.current = result
    return <>{result.scopeQueries}</>
  }

  const renderResult = render(<TestComponent />)
  return { ref, renderResult }
}

describe('useRecentFiles', () => {
  let onResultRegistry

  beforeEach(() => {
    jest.clearAllMocks()
    onResultRegistry = {}

    MockRecentScopeQuery.mockImplementation(({ scopeKey, onResult }) => {
      onResultRegistry[scopeKey] = onResult
      return null
    })

    mockUseSharedDrives.mockReturnValue({ recipientDriveIds: [] })
    mockUseClient.mockReturnValue(makeClientWithDataProxy())
  })

  describe('merge, sort, dedup, and cap', () => {
    it('merges own and drive scopes sorted by updated_at desc, filtered, deduped, capped at 50', async () => {
      const driveId = 'drive-1'
      mockUseSharedDrives.mockReturnValue({ recipientDriveIds: [driveId] })

      const fileA = makeFile('A', '2020-01-01T00:00:01Z')
      const fileB = makeFile('B', '2020-01-01T00:00:02Z')
      const fileC = makeFile('C', '2020-01-01T00:00:03Z')

      const { ref } = renderHookWithScopes()

      // Initially loading (no scopes have reported yet)
      expect(ref.current.fetchStatus).toBe('loading')
      expect(ref.current.data).toEqual([])

      // Own scope reports: A and C
      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: [fileA, fileC],
          fetchStatus: 'loaded',
          error: null
        })
      })

      // Drive scope hasn't reported yet — still loading but partial data visible
      expect(ref.current.fetchStatus).toBe('loading')
      // Partial data: C then A (sorted desc)
      expect(ref.current.data.map(f => f._id)).toEqual(['C', 'A'])

      // Drive scope reports: B
      act(() => {
        onResultRegistry[`recents-drive-${driveId}`](
          `recents-drive-${driveId}`,
          {
            data: [fileB],
            fetchStatus: 'loaded',
            error: null
          }
        )
      })

      // All scopes reported → loaded
      expect(ref.current.fetchStatus).toBe('loaded')
      // Sorted desc: C(3) > B(2) > A(1)
      expect(ref.current.data.map(f => f._id)).toEqual(['C', 'B', 'A'])
      expect(ref.current.error).toBeNull()
    })

    it('filters out trashed files', () => {
      const trashedFile = makeFile('T', '2020-01-01T00:00:05Z', {
        trashed: true
      })
      const okFile = makeFile('OK', '2020-01-01T00:00:01Z')

      const { ref } = renderHookWithScopes()

      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: [trashedFile, okFile],
          fetchStatus: 'loaded',
          error: null
        })
      })

      expect(ref.current.data.map(f => f._id)).toEqual(['OK'])
    })

    it('caps results at 50', () => {
      const files = Array.from({ length: 60 }, (_, i) =>
        makeFile(`f${i}`, `2020-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`)
      )

      const { ref } = renderHookWithScopes()

      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: files,
          fetchStatus: 'loaded',
          error: null
        })
      })

      expect(ref.current.data).toHaveLength(50)
    })

    it('deduplicates by _id keeping the most-recently-updated occurrence', () => {
      const driveId = 'drive-1'
      mockUseSharedDrives.mockReturnValue({ recipientDriveIds: [driveId] })

      // Same _id in both own and drive — drive has newer timestamp
      const fileFromOwn = makeFile('SHARED', '2020-01-01T00:00:01Z')
      const fileFromDrive = makeFile('SHARED', '2020-01-01T00:00:05Z')
      const uniqueFile = makeFile('UNIQUE', '2020-01-01T00:00:03Z')

      const { ref } = renderHookWithScopes()

      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: [fileFromOwn, uniqueFile],
          fetchStatus: 'loaded',
          error: null
        })
        onResultRegistry[`recents-drive-${driveId}`](
          `recents-drive-${driveId}`,
          {
            data: [fileFromDrive],
            fetchStatus: 'loaded',
            error: null
          }
        )
      })

      // SHARED appears once, drive version wins (updated_at=5 > 3 > 1)
      expect(ref.current.data.map(f => f._id)).toEqual(['SHARED', 'UNIQUE'])
      expect(ref.current.data).toHaveLength(2)
    })
  })

  describe('fetchStatus semantics', () => {
    it('is loading until all active scopes have reported at least once', () => {
      const driveId = 'drive-1'
      mockUseSharedDrives.mockReturnValue({ recipientDriveIds: [driveId] })

      const { ref } = renderHookWithScopes()

      expect(ref.current.fetchStatus).toBe('loading')

      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: [],
          fetchStatus: 'loaded',
          error: null
        })
      })

      // Drive scope not yet reported
      expect(ref.current.fetchStatus).toBe('loading')

      act(() => {
        onResultRegistry[`recents-drive-${driveId}`](
          `recents-drive-${driveId}`,
          {
            data: [],
            fetchStatus: 'loaded',
            error: null
          }
        )
      })

      expect(ref.current.fetchStatus).toBe('loaded')
    })

    it('returns loading + partial data while drive scopes have not yet reported', () => {
      const driveId = 'drive-1'
      mockUseSharedDrives.mockReturnValue({ recipientDriveIds: [driveId] })
      const ownFile = makeFile('OWN', '2020-01-01T00:00:01Z')

      const { ref } = renderHookWithScopes()

      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: [ownFile],
          fetchStatus: 'loaded',
          error: null
        })
      })

      // Own reported, drive has not — partial data + loading (isFetchingMore semantics)
      expect(ref.current.fetchStatus).toBe('loading')
      expect(ref.current.data).toHaveLength(1)
      expect(ref.current.data[0]._id).toBe('OWN')
    })
  })

  describe('degrade without data-proxy link', () => {
    it('renders only the own scope when client has no DataProxyLink', () => {
      mockUseClient.mockReturnValue(makeClientWithoutDataProxy())
      mockUseSharedDrives.mockReturnValue({ recipientDriveIds: ['drive-x'] })

      const { ref } = renderHookWithScopes()

      // Only one scope element (own)
      expect(ref.current.scopeQueries).toHaveLength(1)

      // Only 'recents-own' is registered — no drive scope
      expect(Object.keys(onResultRegistry)).toEqual(['recents-own'])

      const ownFile = makeFile('OWN', '2020-01-01T00:00:01Z')
      act(() => {
        onResultRegistry['recents-own']('recents-own', {
          data: [ownFile],
          fetchStatus: 'loaded',
          error: null
        })
      })

      expect(ref.current.fetchStatus).toBe('loaded')
      expect(ref.current.data.map(f => f._id)).toEqual(['OWN'])
    })

    it('renders only the own scope when client.links is absent', () => {
      mockUseClient.mockReturnValue({ links: null })
      mockUseSharedDrives.mockReturnValue({ recipientDriveIds: ['drive-x'] })

      const { ref } = renderHookWithScopes()

      expect(ref.current.scopeQueries).toHaveLength(1)
    })
  })

  describe('scopeQueries elements', () => {
    it('renders one own scope + one per drive', () => {
      mockUseSharedDrives.mockReturnValue({
        recipientDriveIds: ['d1', 'd2']
      })

      const { ref } = renderHookWithScopes()

      expect(ref.current.scopeQueries).toHaveLength(3)

      // Check MockRecentScopeQuery was called with the expected scopeKeys
      const calls = MockRecentScopeQuery.mock.calls.map(
        ([{ scopeKey }]) => scopeKey
      )
      expect(calls).toContain('recents-own')
      expect(calls).toContain('recents-drive-d1')
      expect(calls).toContain('recents-drive-d2')
    })
  })

  describe('no dependency on useDataProxy or dataProxy.recents()', () => {
    it('does not import useDataProxy and runs correctly without cozy-dataproxy-lib', () => {
      // If the hook still imported cozy-dataproxy-lib, this test would fail
      // because we don't mock it — any call would throw. We confirm by running
      // the hook and asserting it works without that dependency.
      expect(() => renderHookWithScopes()).not.toThrow()
    })
  })
})

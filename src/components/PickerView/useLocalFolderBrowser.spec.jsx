import { renderHook } from '@testing-library/react'

import { useQuery } from 'cozy-client'

import { useLocalFolderBrowser } from './useLocalFolderBrowser'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'

jest.mock('cozy-client', () => ({
  isQueryLoading: result =>
    result.fetchStatus === 'pending' || result.fetchStatus === 'loading',
  useQuery: jest.fn()
}))

jest.mock('@/modules/breadcrumb/hooks/useBreadcrumbPath', () => ({
  useBreadcrumbPath: jest.fn()
}))

describe('useLocalFolderBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useBreadcrumbPath.mockReturnValue([{ id: 'root-id', name: 'My Drive' }])
  })

  it('runs folder query and returns source items and breadcrumb', () => {
    const mockQuery = {
      definition: jest.fn(),
      options: { as: 'folder-id' }
    }
    const buildFolderQuery = jest.fn(() => mockQuery)
    const onReady = jest.fn()

    useQuery.mockReturnValue({
      data: [{ _id: 'file-1', name: 'File 1' }],
      fetchStatus: 'loaded',
      hasMore: false,
      fetchMore: null
    })

    const { result } = renderHook(() =>
      useLocalFolderBrowser({
        folderId: 'folder-id',
        rootBreadcrumbPath: { id: 'root-id', name: 'My Drive' },
        buildFolderQuery,
        onReady
      })
    )

    expect(buildFolderQuery).toHaveBeenCalledWith('folder-id')
    expect(useQuery).toHaveBeenCalledWith(
      mockQuery.definition,
      mockQuery.options
    )
    expect(result.current.items).toEqual([{ _id: 'file-1', name: 'File 1' }])
    expect(result.current.fetchStatus).toBe('loaded')
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('does not fire onReady when query is still loading', () => {
    const buildFolderQuery = jest.fn(() => ({
      definition: jest.fn(),
      options: {}
    }))
    const onReady = jest.fn()

    useQuery.mockReturnValue({
      data: [],
      fetchStatus: 'pending'
    })

    const { result } = renderHook(() =>
      useLocalFolderBrowser({
        folderId: 'folder-id',
        rootBreadcrumbPath: { id: 'root-id', name: 'My Drive' },
        buildFolderQuery,
        onReady
      })
    )

    expect(result.current.fetchStatus).toBe('loading')
    expect(onReady).not.toHaveBeenCalled()
  })

  it('filters received shares when filterReceivedShares and allLoaded are true', () => {
    const buildFolderQuery = jest.fn(() => ({
      definition: jest.fn(),
      options: {}
    }))

    useQuery.mockReturnValue({
      data: [
        {
          _id: 'received-share',
          name: 'Received share',
          type: 'directory',
          relationships: {
            referenced_by: {
              data: [{ id: 'sharing-id', type: 'io.cozy.sharings' }]
            }
          }
        },
        { _id: 'own-folder', name: 'Own folder', type: 'directory' }
      ],
      fetchStatus: 'loaded'
    })

    const { result } = renderHook(() =>
      useLocalFolderBrowser({
        folderId: 'folder-id',
        rootBreadcrumbPath: { id: 'root-id', name: 'My Drive' },
        buildFolderQuery,
        filterReceivedShares: true,
        allLoaded: true,
        isOwner: () => false
      })
    )

    expect(result.current.items).toEqual([
      { _id: 'own-folder', name: 'Own folder', type: 'directory' }
    ])
  })
})

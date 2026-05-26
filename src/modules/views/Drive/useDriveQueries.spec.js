import { renderHook } from '@testing-library/react'

import { useQuery } from 'cozy-client'

import { useDriveQueries } from './useDriveQueries'
import { DEFAULT_SORT } from '@/config/sort'
import { buildDriveQuery } from '@/queries'

jest.mock('cozy-client', () => ({
  useQuery: jest.fn()
}))

jest.mock('@/queries', () => ({
  buildDriveQuery: jest.fn(({ currentFolderId, type, sortAttribute, sortOrder }) => ({
    definition: { doctype: 'io.cozy.files', type },
    options: { as: `${type}-${sortAttribute}-${sortOrder}`, currentFolderId }
  }))
}))

const makeFetchResult = overrides => ({
  fetchStatus: 'loaded',
  lastUpdate: Date.now(),
  data: [],
  ...overrides
})

describe('useDriveQueries', () => {
  const folderId = 'folder-id-123'
  const nameSortOrder = { attribute: 'name', order: 'asc' }

  beforeEach(() => {
    jest.clearAllMocks()
    useQuery.mockReturnValue(makeFetchResult())
  })

  describe('buildDriveQuery call arguments', () => {
    it('builds a directory query and a file query', () => {
      renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(buildDriveQuery).toHaveBeenCalledTimes(2)
      expect(buildDriveQuery).toHaveBeenCalledWith({
        currentFolderId: folderId,
        type: 'directory',
        sortAttribute: 'name',
        sortOrder: 'asc'
      })
      expect(buildDriveQuery).toHaveBeenCalledWith({
        currentFolderId: folderId,
        type: 'file',
        sortAttribute: 'name',
        sortOrder: 'asc'
      })
    })

    it('overrides size sort with DEFAULT_SORT for directory query but not file query', () => {
      const sizeSortOrder = { attribute: 'size', order: 'desc' }

      renderHook(() => useDriveQueries(folderId, sizeSortOrder))

      expect(buildDriveQuery).toHaveBeenCalledWith({
        currentFolderId: folderId,
        type: 'directory',
        sortAttribute: DEFAULT_SORT.attribute,
        sortOrder: DEFAULT_SORT.order
      })
      expect(buildDriveQuery).toHaveBeenCalledWith({
        currentFolderId: folderId,
        type: 'file',
        sortAttribute: 'size',
        sortOrder: 'desc'
      })
    })

    it('does not override non-size sort for directory query', () => {
      const updatedAtSort = { attribute: 'updated_at', order: 'desc' }

      renderHook(() => useDriveQueries(folderId, updatedAtSort))

      expect(buildDriveQuery).toHaveBeenCalledWith({
        currentFolderId: folderId,
        type: 'directory',
        sortAttribute: 'updated_at',
        sortOrder: 'desc'
      })
    })
  })

  describe('allResults', () => {
    it('returns both query results as an array', () => {
      const foldersResult = makeFetchResult({ data: [{ _id: 'dir-1' }] })
      const filesResult = makeFetchResult({ data: [{ _id: 'file-1' }] })
      useQuery.mockReturnValueOnce(foldersResult).mockReturnValueOnce(filesResult)

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.allResults).toHaveLength(2)
      expect(result.current.allResults[0]).toBe(foldersResult)
      expect(result.current.allResults[1]).toBe(filesResult)
    })
  })

  describe('isInError', () => {
    it('is false when all results are loaded', () => {
      useQuery.mockReturnValue(makeFetchResult({ fetchStatus: 'loaded' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isInError).toBe(false)
    })

    it('is true when folders result has failed fetchStatus', () => {
      useQuery
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'failed' }))
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'loaded' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isInError).toBe(true)
    })

    it('is true when files result has failed fetchStatus', () => {
      useQuery
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'loaded' }))
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'failed' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isInError).toBe(true)
    })
  })

  describe('isLoading', () => {
    it('is false when all results are loaded', () => {
      useQuery.mockReturnValue(makeFetchResult({ fetchStatus: 'loaded', lastUpdate: Date.now() }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isLoading).toBe(false)
    })

    it('is true when a result is loading and has no lastUpdate', () => {
      useQuery
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'loading', lastUpdate: null }))
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'loaded' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isLoading).toBe(true)
    })

    it('is false when loading but lastUpdate is set (subsequent load)', () => {
      useQuery.mockReturnValue(
        makeFetchResult({ fetchStatus: 'loading', lastUpdate: Date.now() })
      )

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('isPending', () => {
    it('is false when all results are loaded', () => {
      useQuery.mockReturnValue(makeFetchResult({ fetchStatus: 'loaded' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isPending).toBe(false)
    })

    it('is true when folders result is pending', () => {
      useQuery
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'pending' }))
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'loaded' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isPending).toBe(true)
    })

    it('is true when files result is pending', () => {
      useQuery
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'loaded' }))
        .mockReturnValueOnce(makeFetchResult({ fetchStatus: 'pending' }))

      const { result } = renderHook(() => useDriveQueries(folderId, nameSortOrder))

      expect(result.current.isPending).toBe(true)
    })
  })

  it('passes updated currentFolderId to buildDriveQuery on rerender', () => {
    const { rerender } = renderHook(
      ({ fId }) => useDriveQueries(fId, nameSortOrder),
      { initialProps: { fId: 'folder-a' } }
    )

    jest.clearAllMocks()
    rerender({ fId: 'folder-b' })

    expect(buildDriveQuery).toHaveBeenCalledWith(
      expect.objectContaining({ currentFolderId: 'folder-b' })
    )
  })
})
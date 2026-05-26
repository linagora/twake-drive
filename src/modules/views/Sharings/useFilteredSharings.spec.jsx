import { renderHook } from '@testing-library/react'

import flag from 'cozy-flags'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { useTransformFolderListHasSharedDriveShortcuts } from '@/hooks/useTransformFolderListHasSharedDriveShortcuts'

import { useFilteredSharings } from './useFilteredSharings'

jest.mock('@/hooks/useTransformFolderListHasSharedDriveShortcuts', () => ({
  useTransformFolderListHasSharedDriveShortcuts: jest.fn()
}))

const makeResult = (overrides = {}) => ({
  fetchStatus: 'loaded',
  lastFetch: 1000,
  data: [],
  count: 0,
  ...overrides
})

const defaultTransformReturn = {
  sharedDrives: [],
  nonSharedDriveList: [],
  sharedDrivesLoaded: true
}

describe('useFilteredSharings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Both flags off by default (from global setup)
    flag.mockReturnValue(false)
    useTransformFolderListHasSharedDriveShortcuts.mockReturnValue(
      defaultTransformReturn
    )
  })

  describe('when both shared-drive flags are disabled (withoutSharedDrives = true)', () => {
    beforeEach(() => {
      flag.mockReturnValue(false)
    })

    it('filters out items whose dir_id matches SHARED_DRIVES_DIR_ID', () => {
      const normalItem = { _id: 'item-1', dir_id: 'some-folder' }
      const sharedDriveItem = {
        _id: 'item-2',
        dir_id: SHARED_DRIVES_DIR_ID
      }
      const result = makeResult({ data: [normalItem, sharedDriveItem] })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.data).toEqual([normalItem])
    })

    it('keeps items whose dir_id does not match SHARED_DRIVES_DIR_ID', () => {
      const normalItem = { _id: 'item-1', dir_id: 'some-folder' }
      const result = makeResult({ data: [normalItem] })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.data).toEqual([normalItem])
    })

    it('returns empty data when result.data is empty', () => {
      const result = makeResult({ data: [] })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.data).toEqual([])
    })

    it('handles undefined result.data gracefully', () => {
      const result = makeResult({ data: undefined })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.data).toEqual([])
    })

    it('sets sharedDrivesLoaded to true (not blocked by the transform hook)', () => {
      useTransformFolderListHasSharedDriveShortcuts.mockReturnValue({
        sharedDrives: [],
        nonSharedDriveList: [],
        sharedDrivesLoaded: false // would block, but flags are off
      })
      const result = makeResult()

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: [] })
      )

      expect(hookResult.current.sharedDrivesLoaded).toBe(true)
    })
  })

  describe('when shared-drive flag is enabled', () => {
    beforeEach(() => {
      flag.mockImplementation(flagName => {
        if (flagName === 'drive.shared-drive.enabled') return true
        return false
      })
    })

    it('merges transformedSharedDrives and nonSharedDriveList', () => {
      const sharedDrive = { _id: 'sd-1', dir_id: SHARED_DRIVES_DIR_ID }
      const normalFile = { _id: 'file-1', dir_id: 'other' }

      useTransformFolderListHasSharedDriveShortcuts.mockReturnValue({
        sharedDrives: [sharedDrive],
        nonSharedDriveList: [normalFile],
        sharedDrivesLoaded: true
      })

      const result = makeResult({ data: [] })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.data).toEqual([
        sharedDrive,
        normalFile
      ])
    })

    it('uses sharedDrivesLoaded from the transform hook', () => {
      useTransformFolderListHasSharedDriveShortcuts.mockReturnValue({
        sharedDrives: [],
        nonSharedDriveList: [],
        sharedDrivesLoaded: false
      })
      const result = makeResult()

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.sharedDrivesLoaded).toBe(false)
    })
  })

  describe('when federated-shared-folder flag is enabled', () => {
    beforeEach(() => {
      flag.mockImplementation(flagName => {
        if (flagName === 'drive.federated-shared-folder.enabled') return true
        return false
      })
    })

    it('merges transformedSharedDrives and nonSharedDriveList', () => {
      const sharedDrive = { _id: 'sd-2', dir_id: SHARED_DRIVES_DIR_ID }
      useTransformFolderListHasSharedDriveShortcuts.mockReturnValue({
        sharedDrives: [sharedDrive],
        nonSharedDriveList: [],
        sharedDrivesLoaded: true
      })

      const result = makeResult()

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.data).toEqual([sharedDrive])
    })
  })

  describe('fetchStatus and lastFetch overrides when sharedDocumentIds is empty', () => {
    it('overrides fetchStatus to "loaded" when there are no sharedDocumentIds', () => {
      const result = makeResult({ fetchStatus: 'loading', lastFetch: 500 })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: [] })
      )

      expect(hookResult.current.filteredResult.fetchStatus).toBe('loaded')
    })

    it('overrides lastFetch to a recent timestamp when there are no sharedDocumentIds', () => {
      const before = Date.now()
      const result = makeResult({ fetchStatus: 'loading', lastFetch: 500 })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: [] })
      )

      expect(hookResult.current.filteredResult.lastFetch).toBeGreaterThanOrEqual(before)
    })

    it('preserves fetchStatus from result when sharedDocumentIds has entries', () => {
      const result = makeResult({ fetchStatus: 'loading' })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.fetchStatus).toBe('loading')
    })

    it('handles undefined sharedDocumentIds as empty (overrides fetchStatus)', () => {
      const result = makeResult({ fetchStatus: 'loading' })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: undefined })
      )

      expect(hookResult.current.filteredResult.fetchStatus).toBe('loaded')
    })
  })

  describe('count field', () => {
    it('reflects the length of the filtered data', () => {
      const items = [
        { _id: 'a', dir_id: 'folder' },
        { _id: 'b', dir_id: 'folder' }
      ]
      const result = makeResult({ data: items })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.count).toBe(2)
    })

    it('is 0 when filtered data is empty', () => {
      const result = makeResult({ data: [] })

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: ['doc-1'] })
      )

      expect(hookResult.current.filteredResult.count).toBe(0)
    })
  })

  describe('return shape', () => {
    it('returns filteredResult and sharedDrivesLoaded', () => {
      const result = makeResult()

      const { result: hookResult } = renderHook(() =>
        useFilteredSharings({ result, sharedDocumentIds: [] })
      )

      expect(hookResult.current).toHaveProperty('filteredResult')
      expect(hookResult.current).toHaveProperty('sharedDrivesLoaded')
    })
  })
})

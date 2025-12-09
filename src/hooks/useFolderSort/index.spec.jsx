import { renderHook, act } from '@testing-library/react-hooks'

import { useClient, useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import { useFolderSort } from './index'

import { DEFAULT_SORT, SORT_BY_UPDATE_DATE } from '@/config/sort'
import { TRASH_DIR_ID } from '@/constants/config'
import logger from '@/lib/logger'
import { usePublicContext } from '@/modules/public/PublicProvider'

jest.mock('cozy-client', () => ({
  useClient: jest.fn(),
  useQuery: jest.fn()
}))

jest.mock('cozy-flags', () => jest.fn())

jest.mock('@/queries', () => ({
  getDriveSettingQuery: {
    definition: jest.fn(),
    options: { as: 'io.cozy.drive.settings' }
  }
}))

jest.mock('@/lib/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}))

jest.mock('@/modules/public/PublicProvider', () => ({
  usePublicContext: jest.fn()
}))

const mockUseClient = useClient
const mockUseQuery = useQuery
const mockFlag = flag
const mockUsePublicContext = usePublicContext

describe('useFolderSort', () => {
  let mockClient
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    mockClient = {
      save: jest.fn().mockResolvedValue({})
    }
    mockUseClient.mockReturnValue(mockClient)
    mockUseQuery.mockReturnValue({ data: [] })

    mockFlag.mockImplementation(flagName => {
      if (flagName === 'drive.save-sort-choice.enabled') {
        return true
      }
      return false
    })

    mockUsePublicContext.mockReturnValue({
      isPublic: false
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('default sort behavior', () => {
    it('should use DEFAULT_SORT for regular folders', () => {
      const folderId = 'regular-folder-id'
      mockUseQuery.mockReturnValue({ data: [] })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(DEFAULT_SORT)
    })

    it('should use SORT_BY_UPDATE_DATE for trash folder', () => {
      const folderId = TRASH_DIR_ID
      mockUseQuery.mockReturnValue({ data: [] })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(SORT_BY_UPDATE_DATE)
    })

    it('should use SORT_BY_UPDATE_DATE for recent folder', () => {
      const folderId = 'recent'
      mockUseQuery.mockReturnValue({ data: [] })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(SORT_BY_UPDATE_DATE)
    })
  })

  describe('loading existing sorting settings', () => {
    it('should load and apply existing sorting settings when available', () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: 'io.cozy.drive.settings',
        attributes: {
          attribute: 'updated_at',
          order: 'desc'
        }
      }

      mockUseQuery.mockReturnValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual({
        attribute: 'updated_at',
        order: 'desc'
      })
    })

    it('should use default values when settings exist but attributes are missing', () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: 'io.cozy.drive.settings'
      }

      mockUseQuery.mockReturnValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(DEFAULT_SORT)
    })

    it('should return consistent sort values on multiple renders', () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: 'io.cozy.drive.settings',
        attributes: {
          attribute: 'name',
          order: 'asc'
        }
      }

      mockUseQuery.mockReturnValue({
        data: [existingSettings]
      })

      const { result, rerender } = renderHook(() => useFolderSort(folderId))

      const [firstSort] = result.current
      expect(firstSort).toEqual({
        attribute: 'name',
        order: 'asc'
      })

      rerender()

      const [secondSort] = result.current
      expect(secondSort).toEqual({
        attribute: 'name',
        order: 'asc'
      })
    })
  })

  describe('persisting settings', () => {
    it('should persist new sorting settings when no existing settings', async () => {
      const folderId = 'test-folder'
      const newSort = { attribute: 'updated_at', order: 'desc' }

      mockUseQuery.mockReturnValue({ data: [] })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [, setSortOrder] = result.current
      await act(async () => {
        await setSortOrder(newSort)
      })

      expect(mockClient.save).toHaveBeenCalledWith({
        _type: 'io.cozy.drive.settings',
        attributes: {
          attribute: 'updated_at',
          order: 'desc'
        }
      })

      expect(logger.info).toHaveBeenCalledWith(
        'Sort settings persisted',
        newSort
      )
    })

    it('should update existing sorting settings', async () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: 'io.cozy.drive.settings',
        attributes: {
          attribute: 'name',
          order: 'asc'
        }
      }
      const newSort = { attribute: 'updated_at', order: 'desc' }

      mockUseQuery.mockReturnValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [, setSortOrder] = result.current
      await act(async () => {
        await setSortOrder(newSort)
      })

      expect(mockClient.save).toHaveBeenCalledWith({
        ...existingSettings,
        attributes: {
          attribute: 'updated_at',
          order: 'desc'
        }
      })

      expect(logger.info).toHaveBeenCalledWith(
        'Sort settings persisted',
        newSort
      )
    })

    it('should preserve other attributes when updating sorting settings', async () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: 'io.cozy.drive.settings',
        attributes: {
          attribute: 'name',
          order: 'asc',
          preferredDriveViewType: 'grid'
        }
      }
      const newSort = { attribute: 'updated_at', order: 'desc' }

      mockUseQuery.mockReturnValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [, setSortOrder] = result.current
      await act(async () => {
        await setSortOrder(newSort)
      })

      expect(mockClient.save).toHaveBeenCalledWith({
        ...existingSettings,
        attributes: {
          attribute: 'updated_at',
          order: 'desc',
          preferredDriveViewType: 'grid'
        }
      })
    })

    it('should handle save errors gracefully', async () => {
      const folderId = 'test-folder'
      const newSort = { attribute: 'updated_at', order: 'desc' }
      const saveError = new Error('Save failed')

      mockClient.save.mockRejectedValue(saveError)
      mockUseQuery.mockReturnValue({ data: [] })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [, setSortOrder] = result.current
      await act(async () => {
        await setSortOrder(newSort)
      })

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save sorting preference:',
        saveError
      )
    })
  })

  describe('public context behavior', () => {
    it('should not load settings in public view', () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: 'io.cozy.drive.settings',
        attributes: {
          attribute: 'updated_at',
          order: 'desc'
        }
      }

      mockUsePublicContext.mockReturnValue({
        isPublic: true
      })

      mockUseQuery.mockReturnValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current

      expect(currentSort).toEqual(DEFAULT_SORT)
    })

    it('should not persist settings in public view', async () => {
      const folderId = 'test-folder'
      const newSort = { attribute: 'updated_at', order: 'desc' }

      mockUsePublicContext.mockReturnValue({
        isPublic: true
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [, setSortOrder] = result.current
      await act(async () => {
        await setSortOrder(newSort)
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot persist sort: in public view'
      )

      expect(mockClient.save).not.toHaveBeenCalled()
    })
  })
})

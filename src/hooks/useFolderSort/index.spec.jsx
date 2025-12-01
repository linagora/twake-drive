import { renderHook, act } from '@testing-library/react-hooks'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'

import { useFolderSort } from './index'

import { DEFAULT_SORT, SORT_BY_UPDATE_DATE } from '@/config/sort'
import { TRASH_DIR_ID } from '@/constants/config'
import { DOCTYPE_DRIVE_SETTINGS } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { usePublicContext } from '@/modules/public/PublicProvider'

jest.mock('cozy-client', () => ({
  useClient: jest.fn(),
  Q: jest.fn().mockReturnValue('mocked-query'),
  useQuery: jest.fn()
}))

jest.mock('cozy-flags', () => jest.fn())

jest.mock('@/lib/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}))

jest.mock('@/modules/public/PublicProvider', () => ({
  usePublicContext: jest.fn()
}))

const mockUseClient = useClient
const mockFlag = flag
const mockUsePublicContext = usePublicContext

describe('useFolderSort', () => {
  let mockClient
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    mockClient = {
      save: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue({ data: [] })
    }
    mockUseClient.mockReturnValue(mockClient)

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
      mockClient.query.mockResolvedValue({
        data: []
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(DEFAULT_SORT)
    })

    it('should use SORT_BY_UPDATE_DATE for trash folder', () => {
      const folderId = TRASH_DIR_ID
      mockClient.query.mockResolvedValue({
        data: []
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(SORT_BY_UPDATE_DATE)
    })

    it('should use SORT_BY_UPDATE_DATE for recent folder', () => {
      const folderId = 'recent'
      mockClient.query.mockResolvedValue({
        data: []
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(SORT_BY_UPDATE_DATE)
    })
  })

  describe('loading existing sorting settings', () => {
    it('should load and apply existing sorting settings when available', async () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: DOCTYPE_DRIVE_SETTINGS,
        attributes: {
          attribute: 'updated_at',
          order: 'desc'
        }
      }

      mockClient.query.mockResolvedValue({
        data: [existingSettings]
      })

      const { result, waitForNextUpdate } = renderHook(() =>
        useFolderSort(folderId)
      )

      await waitForNextUpdate()

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
        _type: DOCTYPE_DRIVE_SETTINGS
      }

      mockClient.query.mockResolvedValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current
      expect(currentSort).toEqual(DEFAULT_SORT)
    })

    it('should return consistent sort values on multiple renders', async () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: DOCTYPE_DRIVE_SETTINGS,
        attributes: {
          attribute: 'name',
          order: 'asc'
        }
      }

      mockClient.query.mockResolvedValue({
        data: [existingSettings]
      })

      const { result, rerender, waitForNextUpdate } = renderHook(() =>
        useFolderSort(folderId)
      )

      await waitForNextUpdate()

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

      mockClient.query.mockResolvedValue({
        data: []
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [, setSortOrder] = result.current
      await act(async () => {
        await setSortOrder(newSort)
      })

      expect(mockClient.save).toHaveBeenCalledWith({
        _type: DOCTYPE_DRIVE_SETTINGS,
        attributes: {
          ...DEFAULT_SORT,
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
        _type: DOCTYPE_DRIVE_SETTINGS,
        attributes: {
          attribute: 'name',
          order: 'asc'
        }
      }
      const newSort = { attribute: 'updated_at', order: 'desc' }

      mockClient.query.mockResolvedValue({
        data: [existingSettings]
      })

      const { result, waitForNextUpdate } = renderHook(() =>
        useFolderSort(folderId)
      )

      // Wait for the settings to load
      await waitForNextUpdate()

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

    it('should handle save errors gracefully', async () => {
      const folderId = 'test-folder'
      const newSort = { attribute: 'updated_at', order: 'desc' }
      const saveError = new Error('Save failed')

      mockClient.save.mockRejectedValue(saveError)
      mockClient.query.mockResolvedValue({
        data: []
      })

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
    it('should not load settings in public view', async () => {
      const folderId = 'test-folder'
      const existingSettings = {
        _id: 'settings-id',
        _type: DOCTYPE_DRIVE_SETTINGS,
        attributes: {
          attribute: 'updated_at',
          order: 'desc'
        }
      }

      mockUsePublicContext.mockReturnValue({
        isPublic: true
      })

      mockClient.query.mockResolvedValue({
        data: [existingSettings]
      })

      const { result } = renderHook(() => useFolderSort(folderId))

      const [currentSort] = result.current

      expect(currentSort).toEqual(DEFAULT_SORT)

      expect(mockClient.query).not.toHaveBeenCalled()
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

      expect(mockClient.query).not.toHaveBeenCalled()
    })
  })
})

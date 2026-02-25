import { renderHook } from '@testing-library/react-hooks'

import { useTransformFolderListHasSharedDriveShortcuts } from './index'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'

jest.mock('cozy-sharing', () => ({
  useSharingContext: jest.fn()
}))

jest.mock('@/modules/nextcloud/helpers', () => ({
  isNextcloudShortcut: jest.fn()
}))

jest.mock('@/modules/shareddrives/hooks/useSharedDrives', () => ({
  useSharedDrives: jest.fn()
}))

const mockUseSharingContext = require('cozy-sharing').useSharingContext

const mockIsNextcloudShortcut =
  require('@/modules/nextcloud/helpers').isNextcloudShortcut
const mockUseSharedDrives =
  require('@/modules/shareddrives/hooks/useSharedDrives').useSharedDrives

describe('useTransformFolderListHasSharedDriveShortcuts', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    mockUseSharingContext.mockReturnValue({
      isOwner: jest.fn(() => false)
    })

    mockUseSharedDrives.mockReturnValue({
      sharedDrives: []
    })

    mockIsNextcloudShortcut.mockReturnValue(false)
  })

  describe('transformedSharedDrives', () => {
    it('should transform shared drives into directory-like objects', () => {
      const mockSharedDrives = [
        {
          id: 'sharing-1',
          rules: [
            {
              values: ['folder-1'],
              title: 'Shared Drive 1'
            }
          ]
        }
      ]

      mockUseSharedDrives.mockReturnValue({
        sharedDrives: mockSharedDrives
      })

      const { result } = renderHook(() =>
        useTransformFolderListHasSharedDriveShortcuts([])
      )

      expect(result.current.sharedDrives).toHaveLength(1)
      expect(result.current.sharedDrives[0]).toMatchObject({
        _id: 'folder-1',
        id: 'folder-1',
        _type: 'io.cozy.files',
        type: 'directory',
        name: 'Shared Drive 1',
        dir_id: SHARED_DRIVES_DIR_ID,
        driveId: 'sharing-1',
        path: '/Drives/Shared Drive 1'
      })
    })

    it('should return existing file when user is owner', () => {
      const mockSharedDrives = [
        {
          id: 'sharing-1',
          rules: [
            {
              values: ['folder-1'],
              title: 'Shared Drive 1'
            }
          ]
        }
      ]

      const mockFolderList = [
        {
          _id: 'file-1',
          id: 'file-1',
          name: 'Existing File',
          relationships: {
            referenced_by: {
              data: [{ id: 'sharing-1' }]
            }
          }
        }
      ]

      mockUseSharedDrives.mockReturnValue({
        sharedDrives: mockSharedDrives
      })

      mockUseSharingContext.mockReturnValue({
        isOwner: jest.fn(() => true)
      })

      const { result } = renderHook(() =>
        useTransformFolderListHasSharedDriveShortcuts(mockFolderList)
      )

      expect(result.current.sharedDrives).toHaveLength(1)
      expect(result.current.sharedDrives[0]).toMatchObject({
        _id: 'file-1',
        id: 'file-1',
        name: 'Existing File'
      })
    })

    it('should filter out nextcloud shortcuts', () => {
      const mockSharedDrives = [
        {
          id: 'sharing-1',
          rules: [
            {
              values: ['folder-1'],
              title: 'Regular Drive'
            }
          ]
        },
        {
          id: 'sharing-2',
          rules: [
            {
              values: ['folder-2'],
              title: 'Nextcloud Drive'
            }
          ]
        }
      ]

      mockUseSharedDrives.mockReturnValue({
        sharedDrives: mockSharedDrives
      })

      // Mock first drive as regular, second as nextcloud
      mockIsNextcloudShortcut
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      const { result } = renderHook(() =>
        useTransformFolderListHasSharedDriveShortcuts([])
      )

      expect(result.current.sharedDrives).toHaveLength(1)
      expect(result.current.sharedDrives[0].name).toBe('Regular Drive')
    })
  })

  describe('nonSharedDriveList', () => {
    it('should filter out shared drives from folder list', () => {
      const mockFolderList = [
        {
          _id: 'file-1',
          name: 'Regular File',
          dir_id: 'regular-folder'
        },
        {
          _id: 'file-2',
          name: 'Shared Drive File',
          dir_id: SHARED_DRIVES_DIR_ID
        }
      ]

      const { result } = renderHook(() =>
        useTransformFolderListHasSharedDriveShortcuts(mockFolderList)
      )

      expect(result.current.nonSharedDriveList).toHaveLength(1)
      expect(result.current.nonSharedDriveList[0].name).toBe('Regular File')
    })

    it('should include nextcloud shortcuts when showNextcloudFolder is true', () => {
      const mockFolderList = [
        {
          _id: 'file-1',
          name: 'Regular File',
          dir_id: 'regular-folder'
        },
        {
          _id: 'file-2',
          name: 'Nextcloud File',
          dir_id: 'regular-folder'
        }
      ]

      mockIsNextcloudShortcut
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      const { result } = renderHook(() =>
        useTransformFolderListHasSharedDriveShortcuts(mockFolderList, true)
      )

      expect(result.current.nonSharedDriveList).toHaveLength(2)
      expect(result.current.nonSharedDriveList.map(f => f.name)).toEqual([
        'Regular File',
        'Nextcloud File'
      ])
    })

    it('should exclude files referenced by shared drives to avoid duplicates', () => {
      const mockSharedDrives = [
        {
          id: 'sharing-1',
          rules: [
            {
              values: ['folder-1'],
              title: 'Shared Drive 1'
            }
          ]
        }
      ]

      const mockFolderList = [
        {
          _id: 'file-1',
          id: 'file-1',
          name: 'Regular File',
          dir_id: 'regular-folder',
          relationships: {}
        },
        {
          _id: 'file-2',
          id: 'file-2',
          name: 'Shared Drive File',
          dir_id: 'regular-folder',
          relationships: {
            referenced_by: {
              data: [{ id: 'sharing-1' }]
            }
          }
        }
      ]

      mockUseSharedDrives.mockReturnValue({
        sharedDrives: mockSharedDrives,
        isLoaded: true
      })

      mockUseSharingContext.mockReturnValue({
        isOwner: jest.fn(id => id === 'file-2')
      })

      const { result } = renderHook(() =>
        useTransformFolderListHasSharedDriveShortcuts(mockFolderList, true)
      )

      // The file referenced by the shared drive should not be in nonSharedDriveList
      expect(result.current.nonSharedDriveList).toHaveLength(1)
      expect(result.current.nonSharedDriveList[0].name).toBe('Regular File')

      // But it should be in transformedSharedDrives
      expect(result.current.sharedDrives).toHaveLength(1)
      expect(result.current.sharedDrives[0].name).toBe('Shared Drive File')
    })
  })
})

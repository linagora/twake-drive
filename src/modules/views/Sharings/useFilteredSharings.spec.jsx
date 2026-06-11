import { renderHook } from '@testing-library/react'

import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'

import { useFilteredSharings } from './useFilteredSharings'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { useTransformFolderListHasSharedDriveShortcuts } from '@/hooks/useTransformFolderListHasSharedDriveShortcuts'

jest.mock('cozy-flags')
jest.mock('cozy-sharing', () => ({
  useSharingContext: jest.fn()
}))
jest.mock('@/hooks/useTransformFolderListHasSharedDriveShortcuts', () => ({
  useTransformFolderListHasSharedDriveShortcuts: jest.fn()
}))

const ownedFile = { _id: 'owned-file', name: 'Owned file', dir_id: 'dir' }
const receivedFile = {
  _id: 'received-file',
  name: 'Received file',
  dir_id: 'dir'
}
const ownedDrive = { driveId: 'owned-drive', name: 'My drive', owner: true }
const receivedDrive = {
  driveId: 'received-drive',
  name: 'Their drive',
  owner: false
}

const names = result => result.current.filteredResult.data.map(d => d.name)

const setup = ({
  flags = {},
  ownedIds = ['owned-file'],
  resultData = [ownedFile, receivedFile],
  transformedSharedDrives = [ownedDrive, receivedDrive],
  nonSharedDriveList = [ownedFile, receivedFile]
} = {}) => {
  flag.mockImplementation(name => flags[name] ?? false)
  useSharingContext.mockReturnValue({
    isOwner: id => ownedIds.includes(id)
  })
  useTransformFolderListHasSharedDriveShortcuts.mockReturnValue({
    sharedDrives: transformedSharedDrives,
    nonSharedDriveList,
    sharedDrivesLoaded: true
  })

  return renderHook(() =>
    useFilteredSharings({
      result: { data: resultData, fetchStatus: 'loaded', lastFetch: 1 },
      sharedDocumentIds: ['x']
    })
  )
}

describe('useFilteredSharings', () => {
  beforeEach(() => jest.resetAllMocks())

  describe('with shared drives enabled', () => {
    const flags = { 'drive.shared-drive.enabled': true }

    it('drops files the user owns and keeps received ones', () => {
      const { result } = setup({ flags })

      expect(names(result)).toContain('Received file')
      expect(names(result)).not.toContain('Owned file')
    })

    it('drops drives the user owns and keeps received drive links', () => {
      const { result } = setup({ flags })

      expect(names(result)).toContain('Their drive')
      expect(names(result)).not.toContain('My drive')
    })

    it('keeps a drive whose ownership is unknown', () => {
      const { result } = setup({
        flags,
        transformedSharedDrives: [{ driveId: 'd', name: 'Unknown drive' }]
      })

      expect(names(result)).toContain('Unknown drive')
    })
  })

  describe('with shared drives disabled', () => {
    it('drops owned files from the raw result and hides the drives dir', () => {
      const { result } = setup({
        flags: {},
        resultData: [
          ownedFile,
          receivedFile,
          { _id: 'drives', name: 'Drives', dir_id: SHARED_DRIVES_DIR_ID }
        ]
      })

      expect(names(result)).toEqual(['Received file'])
    })
  })
})

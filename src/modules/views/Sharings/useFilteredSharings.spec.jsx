import { renderHook } from '@testing-library/react'

import {
  deduplicateSharingShortcuts,
  useFilteredSharings
} from './useFilteredSharings'

jest.mock('cozy-sharing', () => ({
  useSharingContext: jest.fn()
}))

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@/hooks/useTransformFolderListHasSharedDriveShortcuts', () => ({
  useTransformFolderListHasSharedDriveShortcuts: jest.fn()
}))

const mockFlag = require('cozy-flags').default

const mockUseTransform =
  require('@/hooks/useTransformFolderListHasSharedDriveShortcuts').useTransformFolderListHasSharedDriveShortcuts

const rootFolder = {
  _id: 'folder-photos',
  id: 'folder-photos',
  name: 'Photos',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.root-dir',
  path: '/Photos'
}

const sharedDrivesFolder = {
  _id: 'folder-photos',
  id: 'folder-photos',
  name: 'Photos',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.shared-drives-dir',
  path: '/Drives/Photos'
}

const anotherFolder = {
  _id: 'folder-other',
  id: 'folder-other',
  name: 'Photos',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.root-dir',
  path: '/Archives/Photos'
}

describe('deduplicateSharingShortcuts', () => {
  it('returns the same list when data is empty', () => {
    expect(deduplicateSharingShortcuts([])).toEqual([])
  })

  it('keeps regular entries when there is no duplicate document id', () => {
    const data = [rootFolder, anotherFolder]

    expect(deduplicateSharingShortcuts(data)).toBe(data)
  })

  it('deduplicates same-id transient entries by keeping the regular Drive entry', () => {
    const result = deduplicateSharingShortcuts([sharedDrivesFolder, rootFolder])

    expect(result).toEqual([rootFolder])
  })

  it('keeps the shared-drives entry when it is the only representation', () => {
    expect(deduplicateSharingShortcuts([sharedDrivesFolder])).toEqual([
      sharedDrivesFolder
    ])
  })
})

describe('useFilteredSharings', () => {
  const setupMocks = ({ flags = {} } = {}) => {
    mockFlag.mockImplementation(name => Boolean(flags[name]))
    mockUseTransform.mockReturnValue({
      sharedDrives: [],
      nonSharedDriveList: [],
      sharedDrivesLoaded: true
    })
  }

  it('drops the transient shared-drives duplicate from the rendered list', () => {
    setupMocks()

    const data = [sharedDrivesFolder, rootFolder]
    const result = { data, fetchStatus: 'loaded', lastFetch: Date.now() }

    const { result: hook } = renderHook(() =>
      useFilteredSharings({
        result,
        sharedDocumentIds: [rootFolder._id]
      })
    )

    expect(hook.current.filteredResult.data).toEqual([rootFolder])
    expect(hook.current.filteredResult.count).toBe(1)
  })

  it('deduplicates after merging transformed shared drives and non-shared-drive files', () => {
    mockFlag.mockImplementation(name =>
      [
        'drive.shared-drive.enabled',
        'drive.federated-shared-folder.enabled'
      ].includes(name)
    )
    mockUseTransform.mockReturnValue({
      sharedDrives: [sharedDrivesFolder],
      nonSharedDriveList: [rootFolder],
      sharedDrivesLoaded: true
    })

    const result = {
      data: [rootFolder],
      fetchStatus: 'loaded',
      lastFetch: Date.now()
    }

    const { result: hook } = renderHook(() =>
      useFilteredSharings({
        result,
        sharedDocumentIds: [rootFolder._id]
      })
    )

    expect(hook.current.filteredResult.data).toEqual([rootFolder])
    expect(hook.current.filteredResult.count).toBe(1)
  })
})

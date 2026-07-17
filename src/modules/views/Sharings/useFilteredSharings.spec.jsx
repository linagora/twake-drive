import { renderHook } from '@testing-library/react'

import {
  deduplicateSharingShortcuts,
  getSharingsTabForEntry,
  useFilteredSharings
} from './useFilteredSharings'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

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
const mockUseSharingContext = require('cozy-sharing').useSharingContext

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

const ownedFolder = {
  _id: 'folder-owned',
  id: 'folder-owned',
  name: 'Specs',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.root-dir',
  path: '/Specs'
}

const receivedFolder = {
  _id: 'folder-received',
  id: 'folder-received',
  name: 'Recipes',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.root-dir',
  path: '/Recipes'
}

// A pending sharing invitation materialized as a shortcut file.
const invitationShortcut = {
  _id: 'file-invitation',
  id: 'file-invitation',
  name: 'Contracts.url',
  class: 'shortcut',
  type: 'file',
  dir_id: 'io.cozy.files.root-dir',
  metadata: { sharing: { status: 'new' } }
}

// Drive entries as shaped by useTransformFolderListHasSharedDriveShortcuts,
// which stamps driveId plus the orgDrive/driveOwner classification metadata.
const orgDrive = {
  _id: 'drive-org-root',
  id: 'drive-org-root',
  name: 'Company drive',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.shared-drives-dir',
  driveId: 'sharing-org',
  orgDrive: true,
  driveOwner: false
}

const ownedFederatedDrive = {
  _id: 'drive-owned-root',
  id: 'drive-owned-root',
  name: 'My federated folder',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.shared-drives-dir',
  driveId: 'sharing-fed-owned',
  orgDrive: false,
  driveOwner: true
}

const receivedFederatedDrive = {
  _id: 'drive-received-root',
  id: 'drive-received-root',
  name: 'Partner federated folder',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.shared-drives-dir',
  driveId: 'sharing-fed-received',
  orgDrive: false,
  driveOwner: false
}

// The same organizational drive as a regular Drive row, as it can show up
// alongside the transformed entry during transient sharing updates.
const orgDriveRegularRow = {
  _id: 'drive-org-root',
  id: 'drive-org-root',
  name: 'Company drive',
  class: 'directory',
  type: 'directory',
  dir_id: 'io.cozy.files.root-dir',
  path: '/Company drive'
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

  it('backfills drive classification metadata onto the winning regular entry, whatever the order', () => {
    const merged = {
      ...orgDriveRegularRow,
      driveId: orgDrive.driveId,
      orgDrive: true,
      driveOwner: false
    }

    expect(deduplicateSharingShortcuts([orgDrive, orgDriveRegularRow])).toEqual(
      [merged]
    )
    expect(deduplicateSharingShortcuts([orgDriveRegularRow, orgDrive])).toEqual(
      [merged]
    )
  })
})

describe('getSharingsTabForEntry', () => {
  it('classifies a document the user owns (including link-only shares) as shared by me', () => {
    // A share by link has permissions but no sharing doc; cozy-sharing's
    // isOwner also answers true for it.
    expect(getSharingsTabForEntry(ownedFolder, () => true)).toBe(
      SHARING_TAB_BY_ME
    )
  })

  it('classifies a document shared by someone else as shared with me', () => {
    expect(getSharingsTabForEntry(receivedFolder, () => false)).toBe(
      SHARING_TAB_WITH_ME
    )
  })

  it('classifies a pending invitation shortcut as shared with me even when isOwner reports true', () => {
    // isOwner defaults to true for docs the sharing context does not know,
    // which is the case for not-yet-accepted invitation shortcuts.
    expect(getSharingsTabForEntry(invitationShortcut, () => true)).toBe(
      SHARING_TAB_WITH_ME
    )
  })

  it('classifies an organizational drive as a team drive regardless of ownership', () => {
    expect(
      getSharingsTabForEntry({ ...orgDrive, driveOwner: true }, () => false)
    ).toBe(SHARING_TAB_DRIVES)
  })

  it('classifies a federated drive created by the user as shared by me', () => {
    // Drive ownership comes from the sharing doc attribute, not from isOwner.
    expect(getSharingsTabForEntry(ownedFederatedDrive, () => false)).toBe(
      SHARING_TAB_BY_ME
    )
  })

  it('classifies a federated drive received from someone else as shared with me', () => {
    expect(getSharingsTabForEntry(receivedFederatedDrive, () => true)).toBe(
      SHARING_TAB_WITH_ME
    )
  })
})

describe('useFilteredSharings', () => {
  beforeEach(() => {
    mockUseSharingContext.mockReturnValue({ isOwner: () => false })
  })

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

  describe('tab filtering', () => {
    const driveEntries = [orgDrive, ownedFederatedDrive, receivedFederatedDrive]
    const classicShares = [ownedFolder, receivedFolder, invitationShortcut]

    const setupTabMocks = ({ drivesEnabled = true } = {}) => {
      mockFlag.mockImplementation(
        name => drivesEnabled && name === 'drive.shared-drive.enabled'
      )
      mockUseTransform.mockReturnValue({
        sharedDrives: drivesEnabled ? driveEntries : [],
        nonSharedDriveList: classicShares,
        sharedDrivesLoaded: true
      })
      mockUseSharingContext.mockReturnValue({
        isOwner: id => id === ownedFolder._id
      })
    }

    const renderFiltered = tab => {
      const { result: hook } = renderHook(() =>
        useFilteredSharings({
          result: {
            data: [...classicShares, orgDrive],
            fetchStatus: 'loaded',
            lastFetch: Date.now()
          },
          sharedDocumentIds: [ownedFolder._id, receivedFolder._id],
          tab
        })
      )
      return hook.current.filteredResult
    }

    it('keeps only entries shared with the user on the with-me tab', () => {
      setupTabMocks()

      const { data, count } = renderFiltered(SHARING_TAB_WITH_ME)

      expect(data).toEqual([
        receivedFederatedDrive,
        receivedFolder,
        invitationShortcut
      ])
      expect(count).toBe(3)
    })

    it('keeps only entries shared by the user on the by-me tab', () => {
      setupTabMocks()

      const { data } = renderFiltered(SHARING_TAB_BY_ME)

      expect(data).toEqual([ownedFederatedDrive, ownedFolder])
    })

    it('keeps only organizational drives on the drives tab', () => {
      setupTabMocks()

      const { data } = renderFiltered(SHARING_TAB_DRIVES)

      expect(data).toEqual([orgDrive])
    })

    it('returns the full combined list when no tab is given', () => {
      setupTabMocks()

      const { data } = renderFiltered(undefined)

      expect(data).toEqual([...driveEntries, ...classicShares])
    })

    it('partitions the combined list across the three tabs', () => {
      setupTabMocks()

      const all = renderFiltered(undefined).data
      const partition = [
        ...renderFiltered(SHARING_TAB_DRIVES).data,
        ...renderFiltered(SHARING_TAB_BY_ME).data,
        ...renderFiltered(SHARING_TAB_WITH_ME).data
      ]

      expect(partition).toHaveLength(all.length)
      expect(new Set(partition)).toEqual(new Set(all))
    })

    it('shows no drive entries on any tab when shared drives are disabled', () => {
      setupTabMocks({ drivesEnabled: false })

      expect(renderFiltered(SHARING_TAB_DRIVES).data).toEqual([])
      expect(renderFiltered(SHARING_TAB_BY_ME).data).toEqual([ownedFolder])
      expect(renderFiltered(SHARING_TAB_WITH_ME).data).toEqual([
        receivedFolder,
        invitationShortcut
      ])
    })

    it('classifies an owner-side drive root as shared by me when shared drives are disabled', () => {
      // With the flags off the transform output is ignored, so an
      // owner-side drive root reaches classification as a plain folder
      // (regular dir_id, no stamped drive metadata) and lands on the
      // by-me tab via isOwner — same tab it gets with the flags on.
      setupTabMocks({ drivesEnabled: false })
      mockUseSharingContext.mockReturnValue({
        isOwner: id => [ownedFolder._id, orgDriveRegularRow._id].includes(id)
      })

      const renderTab = tab =>
        renderHook(() =>
          useFilteredSharings({
            result: {
              data: [...classicShares, orgDriveRegularRow],
              fetchStatus: 'loaded',
              lastFetch: Date.now()
            },
            sharedDocumentIds: [ownedFolder._id, orgDriveRegularRow._id],
            tab
          })
        ).result.current.filteredResult.data

      expect(renderTab(SHARING_TAB_BY_ME)).toEqual([
        ownedFolder,
        orgDriveRegularRow
      ])
      expect(renderTab(SHARING_TAB_DRIVES)).toEqual([])
    })

    it('keeps an organizational drive on the drives tab when a regular duplicate wins deduplication', () => {
      mockFlag.mockImplementation(name => name === 'drive.shared-drive.enabled')
      mockUseTransform.mockReturnValue({
        sharedDrives: [orgDrive],
        nonSharedDriveList: [orgDriveRegularRow],
        sharedDrivesLoaded: true
      })

      const renderTab = tab =>
        renderHook(() =>
          useFilteredSharings({
            result: {
              data: [orgDriveRegularRow],
              fetchStatus: 'loaded',
              lastFetch: Date.now()
            },
            sharedDocumentIds: [orgDriveRegularRow._id],
            tab
          })
        ).result.current.filteredResult.data

      expect(renderTab(SHARING_TAB_DRIVES)).toEqual([
        {
          ...orgDriveRegularRow,
          driveId: orgDrive.driveId,
          orgDrive: true,
          driveOwner: false
        }
      ])
      expect(renderTab(SHARING_TAB_WITH_ME)).toEqual([])
      expect(renderTab(SHARING_TAB_BY_ME)).toEqual([])
    })

    it('exposes hasDrives when an org drive is present, whatever the active tab', () => {
      setupTabMocks()

      const { result: hook } = renderHook(() =>
        useFilteredSharings({
          result: {
            data: [...classicShares, orgDrive],
            fetchStatus: 'loaded',
            lastFetch: Date.now()
          },
          sharedDocumentIds: [ownedFolder._id],
          tab: SHARING_TAB_WITH_ME
        })
      )

      expect(hook.current.hasDrives).toBe(true)
    })

    it('reports no drives content when only non-org federated drives exist', () => {
      // Federated drives classify onto with-me/by-me, so they must not
      // make the drives tab appear.
      mockFlag.mockImplementation(name => name === 'drive.shared-drive.enabled')
      mockUseTransform.mockReturnValue({
        sharedDrives: [ownedFederatedDrive, receivedFederatedDrive],
        nonSharedDriveList: classicShares,
        sharedDrivesLoaded: true
      })

      const { result: hook } = renderHook(() =>
        useFilteredSharings({
          result: {
            data: classicShares,
            fetchStatus: 'loaded',
            lastFetch: Date.now()
          },
          sharedDocumentIds: [ownedFolder._id],
          tab: SHARING_TAB_WITH_ME
        })
      )

      expect(hook.current.hasDrives).toBe(false)
    })

    it('reports no drives content when shared drives are disabled', () => {
      setupTabMocks({ drivesEnabled: false })

      const { result: hook } = renderHook(() =>
        useFilteredSharings({
          result: {
            data: [...classicShares, orgDrive],
            fetchStatus: 'loaded',
            lastFetch: Date.now()
          },
          sharedDocumentIds: [ownedFolder._id]
        })
      )

      expect(hook.current.hasDrives).toBe(false)
    })
  })
})

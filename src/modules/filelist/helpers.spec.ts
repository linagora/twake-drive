import { isTrashedDocument, makeParentFolderName } from './helpers'

import { ROOT_DIR_ID, TRASH_DIR_ID, TRASH_DIR_PATH } from '@/constants/config'

type ParentFolderFile = Parameters<typeof makeParentFolderName>[0]

const findDriveName = (driveId: string): string | null =>
  driveId === 'drive-1' ? 'Team drive' : null

const makeFile = (attributes: ParentFolderFile): ParentFolderFile => attributes

describe('makeParentFolderName', () => {
  it('shows / for an item at the local root', () => {
    const file = makeFile({ dir_id: ROOT_DIR_ID, path: '/report.pdf' })

    expect(makeParentFolderName(file, findDriveName)).toBe('/')
  })

  it('shows only the name of the parent folder', () => {
    const file = makeFile({ dir_id: 'dir-1', path: '/Work/2026/report.pdf' })

    expect(makeParentFolderName(file, findDriveName)).toBe('2026')
  })

  it('shows the drive name for an item at the root of a drive', () => {
    const file = makeFile({
      dir_id: 'drive-root',
      driveId: 'drive-1',
      path: '/report.pdf'
    })

    expect(makeParentFolderName(file, findDriveName)).toBe('Team drive')
  })

  it('shows the parent folder name for a nested drive item', () => {
    const file = makeFile({
      dir_id: 'dir-2',
      driveId: 'drive-1',
      path: '/Specs/report.pdf'
    })

    expect(makeParentFolderName(file, findDriveName)).toBe('Specs')
  })

  it('shows nothing for the root of a drive, which has no path', () => {
    const file = makeFile({ driveId: 'drive-1' })

    expect(makeParentFolderName(file, findDriveName)).toBe('')
  })

  it('shows nothing while the drive name is unknown', () => {
    const file = makeFile({
      dir_id: 'drive-root',
      driveId: 'drive-2',
      path: '/report.pdf'
    })

    expect(makeParentFolderName(file, findDriveName)).toBe('')
  })
})

describe('isTrashedDocument', () => {
  it('returns false for null or undefined input', () => {
    expect(isTrashedDocument(null)).toBe(false)
    expect(isTrashedDocument(undefined)).toBe(false)
  })

  it('identifies the trash root directory by _id or id', () => {
    expect(isTrashedDocument({ _id: TRASH_DIR_ID })).toBe(true)
    expect(isTrashedDocument({ id: TRASH_DIR_ID })).toBe(true)
  })

  it('identifies items directly in trash by dir_id', () => {
    expect(isTrashedDocument({ _id: 'doc-1', dir_id: TRASH_DIR_ID })).toBe(true)
  })

  it('identifies files marked with trashed: true', () => {
    expect(isTrashedDocument({ _id: 'file-1', trashed: true })).toBe(true)
  })

  it('identifies folders by exact trash path or descendants under trash path', () => {
    expect(isTrashedDocument({ _id: 'trash-dir', path: TRASH_DIR_PATH })).toBe(
      true
    )
    expect(
      isTrashedDocument({
        _id: 'folder-1',
        path: `${TRASH_DIR_PATH}/Project`
      })
    ).toBe(true)
    expect(
      isTrashedDocument({
        _id: 'folder-2',
        path: `${TRASH_DIR_PATH}/Project/Sub`
      })
    ).toBe(true)
  })

  it('does not falsely match folders whose name happens to start with trash prefix', () => {
    expect(
      isTrashedDocument({
        _id: 'archive',
        path: '/.cozy_trash_backup',
        dir_id: ROOT_DIR_ID
      })
    ).toBe(false)
  })

  it('identifies a file of a trashed folder by its path', () => {
    expect(
      isTrashedDocument({
        _id: 'report',
        dir_id: 'trashed-folder',
        trashed: false,
        path: `${TRASH_DIR_PATH}/Old/report.txt`
      })
    ).toBe(true)
  })

  it('returns false for healthy files and folders', () => {
    expect(
      isTrashedDocument({
        _id: 'root',
        path: '/',
        dir_id: null
      })
    ).toBe(false)
    expect(
      isTrashedDocument({
        _id: 'projects',
        type: 'directory',
        path: '/Projects',
        dir_id: ROOT_DIR_ID
      })
    ).toBe(false)
    expect(
      isTrashedDocument({
        _id: 'invoice',
        type: 'file',
        dir_id: 'projects',
        trashed: false
      })
    ).toBe(false)
  })
})

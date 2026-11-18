import { makeParentFolderName } from './helpers'

import { ROOT_DIR_ID } from '@/constants/config'

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

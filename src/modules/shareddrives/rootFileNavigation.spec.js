import {
  isFileRootSharedDrive,
  isFileRootSharedDriveShortcut,
  isResolvableFileRootSharedDriveShortcut,
  getFileRootSharePath,
  navigateToFileRootViewer
} from './rootFileNavigation'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

describe('isFileRootSharedDrive', () => {
  it.each`
    label                                   | file                                                                                   | expected
    ${'file-root shared drive'}             | ${{ _id: 'file-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }}        | ${true}
    ${'folder-root shared drive'}           | ${{ _id: 'folder-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY }} | ${false}
    ${'regular file'}                       | ${{ _id: 'file-1' }}                                                                   | ${false}
    ${'file-root type without driveId'}     | ${{ _id: 'file-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }}                            | ${false}
    ${'file in a folder-root shared drive'} | ${{ _id: 'file-1', driveId: 'drive-1', dir_id: 'folder-1' }}                           | ${false}
  `('returns $expected for $label', ({ file, expected }) => {
    expect(isFileRootSharedDrive(file)).toBe(expected)
  })

  it.each([null, undefined])('returns false for %p', value => {
    expect(isFileRootSharedDrive(value)).toBe(false)
  })
})

describe('isFileRootSharedDriveShortcut', () => {
  it.each`
    label                                                | file                                                                                                                         | expected
    ${'file-root shortcut on the recipient'}             | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE, mime: 'text/plain' } } }}                | ${true}
    ${'file-root shortcut with extra target fields'}     | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE, class: 'text', mime: 'text/plain' } } }} | ${true}
    ${'directory-root shortcut'}                         | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY, mime: '' } } }}                     | ${false}
    ${'regular shortcut without target'}                 | ${{ class: 'shortcut' }}                                                                                                     | ${false}
    ${'file-root type without shortcut class'}           | ${{ metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE, mime: 'text/plain' } } }}                                   | ${false}
    ${'file without metadata'}                           | ${{ class: 'shortcut' }}                                                                                                     | ${false}
    ${'file-root shortcut without target.mime (legacy)'} | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE } } }}                                    | ${true}
  `('returns $expected for $label', ({ file, expected }) => {
    expect(isFileRootSharedDriveShortcut(file)).toBe(expected)
  })

  it.each([null, undefined])('returns false for %p', value => {
    expect(isFileRootSharedDriveShortcut(value)).toBe(false)
  })
})

describe('isResolvableFileRootSharedDriveShortcut', () => {
  it.each`
    label                                                | file                                                                                                               | expected
    ${'file-root shortcut with target mime'}             | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE, mime: 'text/plain' } } }}      | ${true}
    ${'file-root shortcut without target.mime (legacy)'} | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE } } }}                          | ${false}
    ${'file-root shortcut with empty target.mime'}       | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.FILE, mime: '' } } }}                | ${false}
    ${'directory-root shortcut with target mime'}        | ${{ class: 'shortcut', metadata: { target: { drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY, mime: 'text/plain' } } }} | ${false}
  `('returns $expected for $label', ({ file, expected }) => {
    expect(isResolvableFileRootSharedDriveShortcut(file)).toBe(expected)
  })
})

describe('getFileRootSharePath', () => {
  it.each`
    label                      | file                                     | pathname              | expectedPath
    ${'file with _id'}         | ${{ _id: 'file-1', driveId: 'drive-1' }} | ${'/sharings/drives'} | ${'/sharings/drives/shareddrive/drive-1/file/file-1/share'}
    ${'file with id only'}     | ${{ id: 'file-1', driveId: 'drive-1' }}  | ${'/sharings/drives'} | ${'/sharings/drives/shareddrive/drive-1/file/file-1/share'}
    ${'file outside sharings'} | ${{ _id: 'file-1', driveId: 'drive-1' }} | ${'/recent'}          | ${'/shareddrive/drive-1/file/file-1/share'}
  `('builds share path for $label', ({ file, pathname, expectedPath }) => {
    expect(getFileRootSharePath({ file, pathname })).toBe(expectedPath)
  })
})

describe('navigateToFileRootViewer', () => {
  it('navigates to the viewer path with fromPathname state', () => {
    const navigate = jest.fn()
    navigateToFileRootViewer({
      navigate,
      file: { _id: 'file-1', driveId: 'drive-1' },
      pathname: '/sharings/drives'
    })
    expect(navigate).toHaveBeenCalledWith(
      '/sharings/drives/shareddrive/drive-1/file/file-1',
      { state: { fromPathname: '/sharings/drives' } }
    )
  })

  it('uses direct scope when pathname is empty', () => {
    const navigate = jest.fn()
    navigateToFileRootViewer({
      navigate,
      file: { _id: 'file-1', driveId: 'drive-1' }
    })
    expect(navigate).toHaveBeenCalledWith('/shareddrive/drive-1/file/file-1', {
      state: { fromPathname: '' }
    })
  })
})

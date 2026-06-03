import {
  isFileRootSharedDrive,
  getFileRootViewerPath,
  getFileRootSharePath,
  navigateToFileRootViewer,
  navigateToFileRootShare
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

describe('getFileRootViewerPath', () => {
  it.each`
    label                         | pathname                | expectedPath
    ${'outside sharings'}         | ${'/recent'}            | ${'/shareddrive/drive-1/file/file-1'}
    ${'inside /sharings'}         | ${'/sharings'}          | ${'/sharings/shareddrive/drive-1/file/file-1'}
    ${'inside a nested sharings'} | ${'/sharings/folder-1'} | ${'/sharings/shareddrive/drive-1/file/file-1'}
  `('builds viewer path $label', ({ pathname, expectedPath }) => {
    expect(
      getFileRootViewerPath({
        file: { _id: 'file-1', driveId: 'drive-1' },
        pathname
      })
    ).toBe(expectedPath)
  })

  it('defaults pathname to direct scope', () => {
    expect(
      getFileRootViewerPath({ file: { _id: 'file-1', driveId: 'drive-1' } })
    ).toBe('/shareddrive/drive-1/file/file-1')
  })
})

describe('getFileRootSharePath', () => {
  it.each`
    label                      | file                                     | pathname       | expectedPath
    ${'file with _id'}         | ${{ _id: 'file-1', driveId: 'drive-1' }} | ${'/sharings'} | ${'/sharings/shareddrive/drive-1/file/file-1/share'}
    ${'file with id only'}     | ${{ id: 'file-1', driveId: 'drive-1' }}  | ${'/sharings'} | ${'/sharings/shareddrive/drive-1/file/file-1/share'}
    ${'file outside sharings'} | ${{ _id: 'file-1', driveId: 'drive-1' }} | ${'/recent'}   | ${'/shareddrive/drive-1/file/file-1/share'}
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
      pathname: '/sharings'
    })
    expect(navigate).toHaveBeenCalledWith(
      '/sharings/shareddrive/drive-1/file/file-1',
      { state: { fromPathname: '/sharings' } }
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

describe('navigateToFileRootShare', () => {
  it('navigates to the sharings share path when pathname is inside /sharings', () => {
    const navigate = jest.fn()
    navigateToFileRootShare({
      navigate,
      file: { _id: 'file-1', driveId: 'drive-1' },
      pathname: '/sharings'
    })
    expect(navigate).toHaveBeenCalledWith(
      '/sharings/shareddrive/drive-1/file/file-1/share'
    )
  })

  it('navigates to the direct share path when pathname is outside /sharings', () => {
    const navigate = jest.fn()
    navigateToFileRootShare({
      navigate,
      file: { _id: 'file-1', driveId: 'drive-1' },
      pathname: '/recent'
    })
    expect(navigate).toHaveBeenCalledWith(
      '/shareddrive/drive-1/file/file-1/share'
    )
  })
})

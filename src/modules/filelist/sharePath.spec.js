import { makeFileSharePath } from './sharePath'

import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'

const expectSharePath = ({ file, pathname, expectedPath }) => {
  expect(makeFileSharePath({ file, pathname })).toBe(expectedPath)
}

describe('makeFileSharePath', () => {
  it.each`
    label                                              | file                                                                                          | pathname                                       | expectedPath
    ${'regular file with id'}                          | ${{ id: 'file-1' }}                                                                           | ${'/folder/folder-1'}                          | ${'/folder/folder-1/file/file-1/share'}
    ${'regular file with _id'}                         | ${{ _id: 'file-1' }}                                                                          | ${'/folder/folder-1'}                          | ${'/folder/folder-1/file/file-1/share'}
    ${'file-root shared drive from sharings list'}     | ${{ _id: 'file-1', id: 'file-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }} | ${'/sharings'}                                 | ${'/sharings/shareddrive/drive-1/file-1/share'}
    ${'file-root shared drive with id only'}           | ${{ id: 'file-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }}                | ${'/sharings'}                                 | ${'/sharings/shareddrive/drive-1/file-1/share'}
    ${'file-root shared drive with _id only'}          | ${{ _id: 'file-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }}               | ${'/sharings'}                                 | ${'/sharings/shareddrive/drive-1/file-1/share'}
    ${'file-root shared drive inside nested sharings'} | ${{ _id: 'file-1', id: 'file-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }} | ${'/sharings/shareddrive/drive-1/file/file-1'} | ${'/sharings/shareddrive/drive-1/file/file-1/share'}
    ${'file-root shared drive outside sharings'}       | ${{ _id: 'file-1', id: 'file-1', driveId: 'drive-1', drive_root_type: DRIVE_ROOT_TYPE.FILE }} | ${'/recent'}                                   | ${'/shareddrive/drive-1/file/file-1/share'}
    ${'folder-root shared drive from sharings list'}   | ${{ _id: 'folder-1', id: 'folder-1', driveId: 'drive-1' }}                                    | ${'/sharings'}                                 | ${'/sharings/shareddrive/drive-1/folder-1/share'}
    ${'folder-root shared drive with _id only'}        | ${{ _id: 'folder-1', driveId: 'drive-1' }}                                                    | ${'/sharings'}                                 | ${'/sharings/shareddrive/drive-1/folder-1/share'}
    ${'folder-root shared drive with id only'}         | ${{ id: 'folder-1', driveId: 'drive-1' }}                                                     | ${'/sharings'}                                 | ${'/sharings/shareddrive/drive-1/folder-1/share'}
    ${'folder-root shared drive outside sharings'}     | ${{ _id: 'folder-1', id: 'folder-1', driveId: 'drive-1' }}                                    | ${'/shareddrive/drive-1/folder-1'}             | ${'/shareddrive/drive-1/folder-1/file/folder-1/share'}
  `('builds $label share path', ({ file, pathname, expectedPath }) => {
    expectSharePath({ file, pathname, expectedPath })
  })
})

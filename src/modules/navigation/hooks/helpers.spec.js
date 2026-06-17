import { computeFileType, computeApp, computePath } from './helpers'

import { TRASH_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { DRIVE_ROOT_TYPE } from '@/modules/shareddrives/types'
import { makeExcalidrawFileRoute } from '@/modules/views/Excalidraw/helpers'
import { makeOnlyOfficeFileRoute } from '@/modules/views/OnlyOffice/helpers'

jest.mock('modules/views/OnlyOffice/helpers', () => ({
  makeOnlyOfficeFileRoute: jest.fn()
}))
jest.mock('modules/views/Excalidraw/helpers', () => ({
  ...jest.requireActual('modules/views/Excalidraw/helpers'),
  makeExcalidrawFileRoute: jest.fn()
}))
jest.mock('cozy-flags', () => jest.fn())

describe('computeFileType', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return "trash" for the trash directory', () => {
    const file = { _id: TRASH_DIR_ID }
    expect(computeFileType(file)).toBe('trash')
  })

  it('should return "nextcloud-trash" for Nextcloud trash directory', () => {
    const file = { _id: 'io.cozy.remote.nextcloud.files.trash-dir' }
    expect(computeFileType(file)).toBe('nextcloud-trash')
  })

  it('should return "shared-drive" for files in shared drives directory', () => {
    const file = {
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file'
    }
    expect(computeFileType(file)).toBe('shared-drive')
  })

  it('should return "shared-drive-root-file" for file-root shared drives', () => {
    const file = {
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      driveId: 'drive456',
      drive_root_type: DRIVE_ROOT_TYPE.FILE
    }
    expect(computeFileType(file)).toBe('shared-drive-root-file')
  })

  it('should return "shared-drive" for directory-root shared drives in shared drives directory', () => {
    const file = {
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      driveId: 'drive456',
      drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY
    }
    expect(computeFileType(file)).toBe('shared-drive')
  })

  it('should return "onlyoffice" for file-root shared drives opened by OnlyOffice when Office is enabled', () => {
    const file = {
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      class: 'text',
      name: 'CIR.docx',
      driveId: 'drive456',
      drive_root_type: DRIVE_ROOT_TYPE.FILE
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe('onlyoffice')
  })

  it('should return "onlyoffice" for file-root shared drive .url shortcuts on the recipient when Office is enabled', () => {
    // The recipient sees the file-root sharing as a `.url` shortcut
    // (class: 'shortcut', mime: application/internet-shortcut). The stack
    // exposes the shared file's real class in metadata.target.class so we
    // can route to OnlyOffice without re-deriving the class.
    const file = {
      _id: 'shortcut-1',
      name: 'CIR.docx',
      mime: 'application/internet-shortcut',
      class: 'shortcut',
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      metadata: {
        target: {
          _type: 'io.cozy.files',
          drive_root_type: DRIVE_ROOT_TYPE.FILE,
          class: 'text',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      }
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe('onlyoffice')
  })

  it('should return "onlyoffice" for spreadsheet file-root shared drive .url shortcuts on the recipient', () => {
    const file = {
      _id: 'shortcut-1',
      name: 'Budget.xlsx',
      mime: 'application/internet-shortcut',
      class: 'shortcut',
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      metadata: {
        target: {
          _type: 'io.cozy.files',
          drive_root_type: DRIVE_ROOT_TYPE.FILE,
          class: 'spreadsheet',
          mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      }
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe('onlyoffice')
  })

  it('should return "shared-drive-root-file" for file-root .url shortcuts when Office is disabled', () => {
    const file = {
      _id: 'shortcut-1',
      name: 'CIR.docx',
      mime: 'application/internet-shortcut',
      class: 'shortcut',
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      metadata: {
        target: {
          _type: 'io.cozy.files',
          drive_root_type: DRIVE_ROOT_TYPE.FILE,
          class: 'text',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      }
    }
    expect(computeFileType(file, { isOfficeEnabled: false })).toBe(
      'shared-drive-root-file'
    )
  })

  it('should return "shortcut" for legacy file-root .url shortcuts without metadata.target.mime', () => {
    const file = {
      _id: 'shortcut-1',
      name: 'CIR.docx',
      mime: 'application/internet-shortcut',
      class: 'shortcut',
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      metadata: {
        target: {
          _type: 'io.cozy.files',
          drive_root_type: DRIVE_ROOT_TYPE.FILE
        }
      }
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe('shortcut')
  })

  it('should return "shared-drive" for directory-root .url shortcuts in shared drives directory', () => {
    // Directory-root sharings (drive_root_type: directory) keep the
    // existing `shared-drive` branch behaviour; only the file-root
    // shortcut gets the OnlyOffice dispatch.
    const file = {
      _id: 'shortcut-1',
      name: 'My Drive',
      mime: 'application/internet-shortcut',
      class: 'shortcut',
      dir_id: SHARED_DRIVES_DIR_ID,
      _type: 'io.cozy.files',
      type: 'file',
      metadata: {
        target: {
          _type: 'io.cozy.files',
          drive_root_type: DRIVE_ROOT_TYPE.DIRECTORY
        }
      }
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe(
      'shared-drive'
    )
  })

  it('should return "nextcloud-directory" for Nextcloud directories', () => {
    const file = { _type: 'io.cozy.remote.nextcloud.files', type: 'directory' }
    expect(computeFileType(file)).toBe('nextcloud-directory')
  })

  it('should return "nextcloud-file" for Nextcloud files', () => {
    const file = { _type: 'io.cozy.remote.nextcloud.files', type: 'file' }
    expect(computeFileType(file)).toBe('nextcloud-file')
  })

  it('should return "public-note-same-instance" for public notes on the same instance', () => {
    const file = {
      _type: 'io.cozy.files',
      name: 'My journal.cozy-note',
      type: 'file',
      metadata: {
        title: '',
        version: '0'
      },
      cozyMetadata: {
        createdOn: 'https://example.com/'
      }
    }
    expect(
      computeFileType(file, { isPublic: true, cozyUrl: 'https://example.com' })
    ).toBe('public-note-same-instance')
  })

  it('should return "note" for notes on the same instance', () => {
    const file = {
      _type: 'io.cozy.files',
      name: 'My journal.cozy-note',
      type: 'file',
      metadata: {
        title: '',
        version: '0'
      },
      cozyMetadata: {
        createdOn: 'https://example.com/'
      }
    }
    expect(computeFileType(file, { cozyUrl: 'https://example.com/' })).toBe(
      'note'
    )
  })

  it('should return "public-note" for notes on an another instance', () => {
    const file = {
      _type: 'io.cozy.files',
      name: 'My journal.cozy-note',
      type: 'file',
      metadata: {
        title: '',
        version: '0'
      },
      cozyMetadata: {
        createdOn: 'https://example.com/'
      }
    }
    expect(computeFileType(file, { cozyUrl: 'https://another.com/' })).toBe(
      'public-note'
    )
  })

  it('should return "public-note" for public notes', () => {
    const file = {
      _type: 'io.cozy.files',
      name: 'My journal.cozy-note',
      type: 'file',
      metadata: {
        title: '',
        version: '0'
      },
      cozyMetadata: {
        createdOn: 'https://example.com/'
      }
    }
    expect(
      computeFileType(file, { isPublic: true, cozyUrl: 'https://another.com' })
    ).toBe('public-note')
  })

  it('should return "onlyoffice" for files opened by OnlyOffice when Office is enabled', () => {
    const file = {
      _type: 'io.cozy.files',
      class: 'text',
      name: 'My document.docx',
      type: 'file'
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe('onlyoffice')
  })

  it.each([
    {
      desc: 'should return "excalidraw" for .excalidraw files when Excalidraw is enabled',
      isExcalidrawEnabled: true,
      expected: 'excalidraw'
    },
    {
      desc: 'should return "file" for .excalidraw files when Excalidraw is disabled',
      isExcalidrawEnabled: false,
      expected: 'file'
    }
  ])('$desc', ({ isExcalidrawEnabled, expected }) => {
    const file = {
      _type: 'io.cozy.files',
      name: 'My drawing.excalidraw',
      type: 'file'
    }
    expect(computeFileType(file, { isExcalidrawEnabled })).toBe(expected)
  })

  it('should prefer "excalidraw" over "onlyoffice" for a text-class .excalidraw file', () => {
    const file = {
      _type: 'io.cozy.files',
      class: 'text',
      name: 'My drawing.excalidraw',
      type: 'file'
    }
    expect(
      computeFileType(file, {
        isExcalidrawEnabled: true,
        isOfficeEnabled: true
      })
    ).toBe('excalidraw')
  })

  it('should return "file" for files opened by OnlyOffice when Office is disabled', () => {
    const file = {
      _type: 'io.cozy.files',
      class: 'text',
      name: 'My document.docx',
      type: 'file'
    }
    expect(computeFileType(file, { isOfficeEnabled: false })).toBe('file')
  })

  it('should return "file" for files that OnlyOffice can\'t open (.txt, .md)', () => {
    const file = {
      _type: 'io.cozy.files',
      class: 'text',
      name: 'My markdown.md',
      type: 'file'
    }
    expect(computeFileType(file, { isOfficeEnabled: true })).toBe('file')
  })

  it('should return "nextcloud" for Nextcloud shortcuts', () => {
    const file = {
      _type: 'io.cozy.files',
      class: 'shortcut',
      cozyMetadata: {
        createdByApp: 'nextcloud'
      }
    }
    expect(computeFileType(file)).toBe('nextcloud')
  })

  it('should return "shortcut" for other shortcuts', () => {
    const file = { _type: 'io.cozy.files', class: 'shortcut' }
    expect(computeFileType(file)).toBe('shortcut')
  })

  it('should return "directory" for directories', () => {
    const file = { _type: 'io.cozy.files', type: 'directory' }
    expect(computeFileType(file)).toBe('directory')
  })

  it('should return "file" for files with driveId but not in shared drives directory', () => {
    const file = {
      dir_id: 'regular-folder',
      _type: 'io.cozy.files',
      type: 'file',
      driveId: 'drive789'
    }
    expect(computeFileType(file)).toBe('file')
  })

  it('should return "file" for shared-drive root files (file-root sharings) owned by the user', () => {
    // When the user is the owner of a federated sharing whose root is a
    // file, the file lives on the user's instance in a regular folder
    // (typically `io.cozy.files.root-dir`), not in the shared-drives
    // directory. It should therefore be opened as a normal file, not
    // routed through `/sharings/shareddrive/...`.
    const file = {
      _id: '3d8083154feb44bb1abef401040173d5',
      _type: 'io.cozy.files',
      type: 'file',
      mime: 'text/markdown',
      class: 'text',
      name: 'test.md',
      dir_id: 'io.cozy.files.root-dir',
      driveId: '3d8083154feb44bb1abef40104018386',
      drive_root_type: DRIVE_ROOT_TYPE.FILE
    }
    expect(computeFileType(file)).toBe('file')
  })

  it('should return "shared-drive-root-file" for shared-drive root files in the shared-drives directory', () => {
    // Counterpart of the owner case: when a recipient views a file-root
    // sharing from `/sharings`, the synthetic root file lives in
    // `SHARED_DRIVES_DIR_ID` and must keep its `shared-drive-root-file`
    // classification so the path stays scoped to the shared drive.
    const file = {
      _type: 'io.cozy.files',
      type: 'file',
      dir_id: SHARED_DRIVES_DIR_ID,
      driveId: '3d8083154feb44bb1abef40104018386',
      drive_root_type: DRIVE_ROOT_TYPE.FILE
    }
    expect(computeFileType(file)).toBe('shared-drive-root-file')
  })
})

describe('computeApp', () => {
  it('should return "nextcloud" for "nextcloud-file" type', () => {
    expect(computeApp('nextcloud-file')).toBe('nextcloud')
  })

  it('should return "notes" for "note" type', () => {
    expect(computeApp('note')).toBe('notes')
  })

  it('should return "drive" for any other types', () => {
    expect(computeApp('unknown-type')).toBe('drive')
    expect(computeApp('file')).toBe('drive')
  })
})

describe('computePath', () => {
  it('should return correct path for trash', () => {
    expect(computePath({}, { type: 'trash', pathname: '/any/path' })).toBe(
      '/trash'
    )
  })

  it('should return correct path for nextcloud-trash', () => {
    expect(
      computePath({}, { type: 'nextcloud-trash', pathname: '/some/path' })
    ).toBe('/some/path/trash')
  })

  it('should return correct path for nextcloud', () => {
    const file = { cozyMetadata: { sourceAccount: 'account1' } }
    expect(computePath(file, { type: 'nextcloud', pathname: '/any' })).toBe(
      '/nextcloud/account1'
    )
  })

  it('should return correct path for nextcloud-directory', () => {
    const file = { path: '/folder' }
    expect(
      computePath(file, { type: 'nextcloud-directory', pathname: '/some/path' })
    ).toBe('/some/path?path=/folder')
  })

  it('should return correct path for nextcloud-file', () => {
    const file = { links: { self: '/file/link' } }
    expect(
      computePath(file, { type: 'nextcloud-file', pathname: '/any' })
    ).toBe('/file/link')
  })

  it('should return correct path for note', () => {
    const file = { _id: 'note123' }
    expect(computePath(file, { type: 'note', pathname: '/any' })).toBe(
      '/n/note123'
    )
  })

  it('should return correct path for public-note', () => {
    const file = { _id: 'note123' }
    expect(
      computePath(file, { type: 'public-note', pathname: '/public' })
    ).toBe('/note/note123')
  })

  it('should return correct path for public-note with driveId in shared drive', () => {
    const file = { _id: 'note123', driveId: 'drive456' }
    expect(
      computePath(file, { type: 'public-note', pathname: '/public' })
    ).toBe('/note/drive456/note123?returnUrl=')
  })

  it('should return correct path for public-note-same-instance', () => {
    const file = { _id: 'note123' }
    expect(
      computePath(file, {
        type: 'public-note-same-instance',
        pathname: '/public'
      })
    ).toBe('/?id=note123')
  })

  it('should return correct path for shortcut', () => {
    const file = { _id: 'shortcut123' }
    expect(computePath(file, { type: 'shortcut', pathname: '/any' })).toBe(
      '/external/shortcut123'
    )
  })

  it('should return correct path for directory at root', () => {
    const file = { _id: 'dir123' }
    expect(computePath(file, { type: 'directory', pathname: '/root' })).toBe(
      'dir123'
    )
  })

  it('should return correct path for nested directory', () => {
    const file = { _id: 'dir123' }
    expect(
      computePath(file, { type: 'directory', pathname: '/root/nested' })
    ).toBe('../dir123')
  })

  it.each([
    {
      type: 'onlyoffice',
      builder: makeOnlyOfficeFileRoute,
      route: '/onlyoffice/route'
    },
    {
      type: 'excalidraw',
      builder: makeExcalidrawFileRoute,
      route: '/excalidraw/route'
    }
  ])('should return correct path for $type', ({ type, builder, route }) => {
    const file = { _id: 'file123' }
    builder.mockReturnValue(route)
    expect(
      computePath(file, { type, pathname: '/some/path', isPublic: true })
    ).toBe(route)
    expect(builder).toHaveBeenCalledWith('file123', {
      driveId: undefined,
      fromPathname: '/some/path',
      fromPublicFolder: true
    })
  })

  it('should return correct path for shared-drive', () => {
    const file = { _id: 'file123', driveId: 'drive456' }
    expect(computePath(file, { type: 'shared-drive', pathname: '/any' })).toBe(
      '/shareddrive/drive456/file123'
    )
  })

  it('should return correct path for shared-drive-root-file', () => {
    const file = {
      _id: 'file123',
      driveId: 'drive456',
      _type: 'io.cozy.files'
    }
    expect(
      computePath(file, {
        type: 'shared-drive-root-file',
        pathname: '/any'
      })
    ).toBe('/shareddrive/drive456/file/file123')
  })

  it('should return sharings-scoped path for shared-drive-root-file from sharings', () => {
    const file = {
      _id: 'file123',
      driveId: 'drive456',
      _type: 'io.cozy.files'
    }
    expect(
      computePath(file, {
        type: 'shared-drive-root-file',
        pathname: '/sharings'
      })
    ).toBe('/sharings/shareddrive/drive456/file/file123')
  })

  it('should return correct for shared-drive in case user is owner', () => {
    const file = { _id: 'file123' }
    expect(computePath(file, { type: 'shared-drive', pathname: '/any' })).toBe(
      '/folder/file123'
    )
  })

  it('should return correct path for shared-drive-file', () => {
    const file = {
      _id: 'file123',
      dir_id: SHARED_DRIVES_DIR_ID,
      driveId: 'drive789',
      _type: 'io.cozy.files'
    }
    expect(
      computePath(file, { type: 'shared-drive-file', pathname: '/any' })
    ).toBe('/shareddrive/drive789/io.cozy.files.shared-drives-dir/file/file123')
  })

  it('should throw error for shared-drive-file without driveId', () => {
    const file = {
      _id: 'file123',
      dir_id: 'dir456',
      _type: 'io.cozy.files'
    }
    expect(() =>
      computePath(file, { type: 'shared-drive-file', pathname: '/any' })
    ).toThrow('Missing driveId or invalid file type in shared drive file')
  })

  it('should throw error for shared-drive-file without dir_id', () => {
    const file = {
      _id: 'file123',
      driveId: 'drive789',
      _type: 'io.cozy.files'
    }
    expect(() =>
      computePath(file, { type: 'shared-drive-file', pathname: '/any' })
    ).toThrow('Missing dir_id in shared drive file')
  })

  it('should return correct path for default case', () => {
    const file = { _id: 'file123' }
    expect(computePath(file, { type: 'unknown', pathname: '/any' })).toBe(
      'file/file123'
    )
  })

  it('should return /folder/:id for an owner folder opened from /sharings', () => {
    // When the user is the owner of a sharing shown in /sharings, the
    // folder is the real io.cozy.files document living in their Drive.
    // The path must drop the /sharings prefix and use the normal Drive
    // folder view.
    const file = { _id: 'folder-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'directory',
        pathname: '/sharings',
        isPublic: false,
        client: null,
        isOwner: true
      })
    ).toBe('/folder/folder-1')
  })

  it('should return /folder/:id for an owner folder opened from a nested /sharings/folder', () => {
    // The owner detection also covers nested sharings views (a folder
    // browsed inside /sharings).
    const file = { _id: 'folder-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'directory',
        pathname: '/sharings/parent-folder',
        isPublic: false,
        client: null,
        isOwner: true
      })
    ).toBe('/folder/folder-1')
  })

  it('should return /folder/:dirId/file/:id for an owner file opened from /sharings', () => {
    // Symmetric case for files: owner files shown in /sharings open in
    // the normal Drive viewer (`FilesViewerDrive`).
    const file = { _id: 'file-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'file',
        pathname: '/sharings',
        isPublic: false,
        client: null,
        isOwner: true
      })
    ).toBe('/folder/io.cozy.files.root-dir/file/file-1')
  })

  it('should keep the sharings path for a recipient directory in /sharings', () => {
    // Non-owner case must remain on the existing relative /sharings path
    // so the recipient keeps browsing inside the sharings section.
    const file = { _id: 'folder-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'directory',
        pathname: '/sharings',
        isPublic: false,
        client: null,
        isOwner: false
      })
    ).toBe('folder-1')
  })

  it('should keep the sharings path for a recipient file in /sharings', () => {
    // Non-owner case for a file: stays on `file/:id` (resolves to
    // /sharings/file/:id) so the recipient keeps using the sharings
    // viewer.
    const file = { _id: 'file-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'file',
        pathname: '/sharings',
        isPublic: false,
        client: null,
        isOwner: false
      })
    ).toBe('file/file-1')
  })

  it('should not redirect an owner file outside /sharings', () => {
    // Outside /sharings the isOwner flag must not influence the path:
    // the regular Drive behaviour (relative path) is preserved.
    const file = { _id: 'file-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'file',
        pathname: '/folder/parent',
        isPublic: false,
        client: null,
        isOwner: true
      })
    ).toBe('file/file-1')
  })

  it('should default to non-owner behaviour when isOwner is undefined', () => {
    // Backward compatibility: callers that don't pass isOwner keep the
    // historical relative path.
    const file = { _id: 'folder-1', dir_id: 'io.cozy.files.root-dir' }
    expect(
      computePath(file, {
        type: 'directory',
        pathname: '/sharings'
      })
    ).toBe('folder-1')
  })
})

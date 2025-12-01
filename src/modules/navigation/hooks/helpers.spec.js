import { computeFileType, computeApp, computePath } from './helpers'

import { TRASH_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { makeOnlyOfficeFileRoute } from '@/modules/views/OnlyOffice/helpers'

jest.mock('modules/views/OnlyOffice/helpers', () => ({
  makeOnlyOfficeFileRoute: jest.fn()
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

  it('should return "file" for other files', () => {
    const file = { _type: 'io.cozy.files', type: 'file' }
    expect(computeFileType(file)).toBe('file')
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
    ).toBe('/note/drive456/note123')
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

  it('should return correct path for onlyoffice', () => {
    const file = { _id: 'file123' }
    makeOnlyOfficeFileRoute.mockReturnValue('/onlyoffice/route')
    expect(
      computePath(file, {
        type: 'onlyoffice',
        pathname: '/some/path',
        isPublic: true
      })
    ).toBe('/onlyoffice/route')
    expect(makeOnlyOfficeFileRoute).toHaveBeenCalledWith('file123', {
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

  it('should return correct for shared-drive in case user is owner', () => {
    const file = { _id: 'file123' }
    expect(computePath(file, { type: 'shared-drive', pathname: '/any' })).toBe(
      '/folder/file123'
    )
  })

  it('should return correct path for shared-drive-file', () => {
    const file = {
      _id: 'file123',
      dir_id: 'dir456',
      driveId: 'drive789',
      _type: 'io.cozy.files'
    }
    expect(
      computePath(file, { type: 'shared-drive-file', pathname: '/any' })
    ).toBe('/shareddrive/drive789/dir456/file/file123')
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
})

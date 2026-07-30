import type { IOCozyFile } from 'cozy-client/types/types'

import {
  type DocumentSharingReferences,
  getSharingsLastUpdatedAt,
  type SharingActivityDocument,
  type SharingsTimestampContext
} from './getSharingsLastUpdatedAt'

const BASE_FILE: IOCozyFile = {
  _id: 'file-id',
  _rev: '1-revision',
  _type: 'io.cozy.files',
  dir_id: 'directory-id',
  name: 'File',
  metadata: {},
  type: 'file',
  class: '',
  mime: 'application/octet-stream',
  executable: false,
  encrypted: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-02-01T00:00:00.000Z',
  size: 0,
  trashed: false
}

function makeFile(overrides: Partial<IOCozyFile> = {}): IOCozyFile {
  return {
    ...BASE_FILE,
    ...overrides,
    metadata: {
      ...BASE_FILE.metadata,
      ...overrides.metadata
    }
  }
}

function makeTimestampDocument(
  id: string,
  createdAt: string,
  updatedAt: string
): SharingActivityDocument {
  return {
    id,
    attributes: {
      created_at: createdAt,
      updated_at: updatedAt
    }
  }
}

function makeContext({
  byDocId = {},
  sharings = [],
  permissions = []
}: {
  byDocId?: Record<string, DocumentSharingReferences>
  sharings?: SharingActivityDocument[]
  permissions?: SharingActivityDocument[]
} = {}): SharingsTimestampContext {
  return {
    byDocId,
    getSharingById: sharingId =>
      sharings.find(sharing => sharing.id === sharingId) ?? null,
    getDocumentPermissions: (documentId): SharingActivityDocument[] => {
      const permissionIds = byDocId[documentId]?.permissions ?? []
      return permissions.filter(permission =>
        permissionIds.includes(permission.id)
      )
    }
  }
}

describe('getSharingsLastUpdatedAt', () => {
  it('returns the latest file timestamp when sharing activity is older', () => {
    const file = makeFile({
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-02-01T00:00:00.000Z'
    })

    expect(getSharingsLastUpdatedAt(file, makeContext())).toBe(
      '2026-03-01T00:00:00.000Z'
    )
  })

  it('returns the latest timestamp from every sharing linked to the file', () => {
    const sharings = [
      makeTimestampDocument(
        'sharing-1',
        '2026-01-01T00:00:00.000Z',
        '2026-03-01T00:00:00.000Z'
      ),
      makeTimestampDocument(
        'sharing-2',
        '2026-04-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z'
      )
    ]
    const context = makeContext({
      byDocId: {
        'file-id': {
          sharings: ['sharing-1', 'sharing-2'],
          permissions: []
        }
      },
      sharings
    })

    expect(getSharingsLastUpdatedAt(BASE_FILE, context)).toBe(
      '2026-04-01T00:00:00.000Z'
    )
  })

  it('includes permission activity for link-only shares', () => {
    const permission = makeTimestampDocument(
      'permission-1',
      '2026-03-01T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z'
    )
    const context = makeContext({
      byDocId: {
        'file-id': {
          sharings: [],
          permissions: ['permission-1']
        }
      },
      permissions: [permission]
    })

    expect(getSharingsLastUpdatedAt(BASE_FILE, context)).toBe(
      '2026-05-01T00:00:00.000Z'
    )
  })

  it('resolves a shared drive directly through its drive id', () => {
    const drive = makeTimestampDocument(
      'drive-sharing',
      '2026-03-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z'
    )
    const driveRoot = {
      ...BASE_FILE,
      driveId: drive.id
    }

    expect(
      getSharingsLastUpdatedAt(driveRoot, makeContext({ sharings: [drive] }))
    ).toBe('2026-06-01T00:00:00.000Z')
  })

  it('keeps pending invitation activity on the shortcut document', () => {
    const shortcut = makeFile({
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
      metadata: {
        target: {
          updated_at: '2026-07-01T00:00:00.000Z'
        }
      }
    })

    expect(getSharingsLastUpdatedAt(shortcut, makeContext())).toBe(
      '2026-05-01T00:00:00.000Z'
    )
  })

  it('compares timezone offsets by instant while preserving the source value', () => {
    const sharing = makeTimestampDocument(
      'sharing-1',
      '2026-02-01T12:00:00.000+02:00',
      '2026-02-01T09:00:00.000Z'
    )
    const context = makeContext({
      byDocId: {
        'file-id': {
          sharings: [sharing.id],
          permissions: []
        }
      },
      sharings: [sharing]
    })

    expect(getSharingsLastUpdatedAt(BASE_FILE, context)).toBe(
      '2026-02-01T12:00:00.000+02:00'
    )
  })

  it('ignores malformed timestamps and returns null when none are valid', () => {
    const file = makeFile({
      created_at: 'not-a-date',
      updated_at: ''
    })
    const sharing = makeTimestampDocument(
      'sharing-1',
      'invalid',
      'also-invalid'
    )
    const context = makeContext({
      byDocId: {
        'file-id': {
          sharings: [sharing.id],
          permissions: []
        }
      },
      sharings: [sharing]
    })

    expect(getSharingsLastUpdatedAt(file, context)).toBe(null)
  })
})

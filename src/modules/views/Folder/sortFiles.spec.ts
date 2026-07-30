import type { IOCozyFile } from 'cozy-client/types/types'

import { sortFiles } from './sortFiles'

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
  updated_at: '2026-01-01T00:00:00.000Z',
  size: 0,
  trashed: false
}

function makeFile(
  id: string,
  name: string,
  type: 'file' | 'directory'
): IOCozyFile {
  return {
    ...BASE_FILE,
    _id: id,
    name,
    type
  }
}

describe('sortFiles', () => {
  const folder = makeFile('folder', 'Zoo', 'directory')
  const newestFile = makeFile('newest-file', 'Alpha', 'file')
  const oldestFile = makeFile('oldest-file', 'Beta', 'file')
  const timestamps: Record<string, string> = {
    folder: '2026-02-01T00:00:00.000Z',
    'newest-file': '2026-03-01T00:00:00.000Z',
    'oldest-file': '2026-01-01T00:00:00.000Z'
  }
  const getFileLastUpdatedAt = (file: IOCozyFile): string | null =>
    timestamps[file._id] ?? null

  it('sorts updated dates through the supplied timestamp resolver', () => {
    const result = sortFiles(
      [oldestFile, folder, newestFile],
      { attribute: 'updated_at', order: 'desc' },
      {
        getFileLastUpdatedAt,
        groupDirectoriesFirstByUpdatedAt: false
      }
    )

    expect(result.map(file => file._id)).toEqual([
      'newest-file',
      'folder',
      'oldest-file'
    ])
  })

  it('can retain directory grouping for updated-date sorting', () => {
    const result = sortFiles(
      [oldestFile, folder, newestFile],
      { attribute: 'updated_at', order: 'desc' },
      { getFileLastUpdatedAt }
    )

    expect(result.map(file => file._id)).toEqual([
      'folder',
      'newest-file',
      'oldest-file'
    ])
  })

  it('sorts timezone offsets by their chronological instant', () => {
    const earlier = makeFile('earlier', 'Earlier', 'file')
    const later = makeFile('later', 'Later', 'file')
    const offsetTimestamps: Record<string, string> = {
      earlier: '2026-03-01T10:00:00.000+02:00',
      later: '2026-03-01T09:00:00.000Z'
    }

    const result = sortFiles(
      [earlier, later],
      { attribute: 'updated_at', order: 'desc' },
      {
        getFileLastUpdatedAt: file => offsetTimestamps[file._id] ?? null,
        groupDirectoriesFirstByUpdatedAt: false
      }
    )

    expect(result.map(file => file._id)).toEqual(['later', 'earlier'])
  })

  it('keeps missing or malformed timestamps after valid timestamps', () => {
    const missing = makeFile('missing', 'Missing', 'file')
    const malformed = makeFile('malformed', 'Malformed', 'file')

    const result = sortFiles(
      [missing, newestFile, malformed],
      { attribute: 'updated_at', order: 'desc' },
      {
        getFileLastUpdatedAt: file => {
          if (file._id === 'missing') return null
          if (file._id === 'malformed') return 'not-a-date'
          return timestamps[file._id] ?? null
        },
        groupDirectoriesFirstByUpdatedAt: false
      }
    )

    expect(result.map(file => file._id)).toEqual([
      'newest-file',
      'missing',
      'malformed'
    ])
  })

  it('keeps directory grouping for non-date sorting', () => {
    const result = sortFiles(
      [oldestFile, folder, newestFile],
      { attribute: 'name', order: 'asc' },
      {
        getFileLastUpdatedAt,
        groupDirectoriesFirstByUpdatedAt: false
      }
    )

    expect(result.map(file => file._id)).toEqual([
      'folder',
      'newest-file',
      'oldest-file'
    ])
  })
})

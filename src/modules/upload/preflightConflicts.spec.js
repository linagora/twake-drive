import {
  fetchFolderFirstLevelItems,
  hasMatchingPreflightUploadConflict,
  hasPreflightUploadConflicts,
  getUploadFirstLevelEntries
} from './preflightConflicts'

import { DOCTYPE_FILES } from '@/lib/doctypes'

describe('upload preflight conflicts', () => {
  describe('fetchFolderFirstLevelItems', () => {
    it('fetches every page of the target folder first-level contents', async () => {
      const statById = jest.fn()
      const client = {
        collection: jest.fn(() => ({ statById }))
      }
      statById
        .mockResolvedValueOnce({
          included: [{ _id: 'file-1', name: 'hello.docx', type: 'file' }],
          links: { next: '/files/root?page[cursor]=cursor-2' }
        })
        .mockResolvedValueOnce({
          included: [{ id: 'folder-1', name: 'Photos', type: 'directory' }],
          links: {}
        })

      const result = await fetchFolderFirstLevelItems(
        client,
        'root-folder-id',
        'drive-id'
      )

      expect(client.collection).toHaveBeenCalledWith(DOCTYPE_FILES, {
        driveId: 'drive-id'
      })
      expect(statById).toHaveBeenNthCalledWith(1, 'root-folder-id', {
        'page[limit]': 100
      })
      expect(statById).toHaveBeenNthCalledWith(2, 'root-folder-id', {
        'page[cursor]': 'cursor-2',
        'page[limit]': 100
      })
      expect(result).toEqual([
        { _id: 'file-1', name: 'hello.docx', type: 'file' },
        { id: 'folder-1', name: 'Photos', type: 'directory' }
      ])
    })
  })

  describe('getUploadFirstLevelEntries', () => {
    it('returns first-level entries from root items', () => {
      const looseFile = new File(['a'], 'hello.docx')
      const result = getUploadFirstLevelEntries([
        { root: true, file: looseFile, isDirectory: false, entry: null },
        {
          root: true,
          file: null,
          isDirectory: true,
          entry: { name: 'Photos' }
        },
        {
          root: true,
          file: null,
          isDirectory: true,
          entry: { name: 'Photos' }
        },
        {
          root: false,
          file: new File(['a'], 'ignored.txt'),
          isDirectory: false
        }
      ])

      expect(result).toEqual([
        { name: 'hello.docx', type: 'file' },
        { name: 'Photos', type: 'directory' },
        { name: 'Photos', type: 'directory' }
      ])
    })
  })

  describe('hasMatchingPreflightUploadConflict', () => {
    it('detects file-vs-file name conflicts', () => {
      const result = hasMatchingPreflightUploadConflict(
        [
          { name: 'hello.docx', type: 'file' },
          { name: 'Photos', type: 'directory' }
        ],
        [
          { _id: 'existing-file-id', name: 'hello.docx', type: 'file' },
          { id: 'existing-folder-id', name: 'Photos', type: 'directory' }
        ]
      )

      expect(result).toBe(true)
    })

    it('detects folder-vs-folder name conflicts', () => {
      const result = hasMatchingPreflightUploadConflict(
        [{ name: 'Photos', type: 'directory' }],
        [{ id: 'existing-folder-id', name: 'Photos', type: 'directory' }]
      )

      expect(result).toBe(true)
    })

    it('detects folder-vs-file name conflicts', () => {
      const result = hasMatchingPreflightUploadConflict(
        [{ name: 'Archive', type: 'directory' }],
        [{ id: 'existing-file-folder-name', name: 'Archive', type: 'file' }]
      )

      expect(result).toBe(true)
    })

    it('detects file-vs-folder name conflicts', () => {
      const result = hasMatchingPreflightUploadConflict(
        [{ name: 'Photos', type: 'file' }],
        [{ id: 'existing-folder-id', name: 'Photos', type: 'directory' }]
      )

      expect(result).toBe(true)
    })

    it('returns false when first-level names do not collide', () => {
      const result = hasMatchingPreflightUploadConflict(
        [{ name: 'Notes', type: 'file' }],
        [{ id: 'existing-folder-id', name: 'Photos', type: 'directory' }]
      )

      expect(result).toBe(false)
    })
  })

  describe('hasPreflightUploadConflicts', () => {
    it('loads target folder contents and returns whether a preflight conflict exists', async () => {
      const statById = jest.fn().mockResolvedValue({
        included: [
          { id: 'existing-file-id', name: 'hello.docx', type: 'file' }
        ],
        links: {}
      })
      const client = {
        collection: jest.fn(() => ({ statById }))
      }
      const file = new File(['a'], 'hello.docx')

      const result = await hasPreflightUploadConflicts({
        client,
        entries: [{ root: true, file, isDirectory: false, entry: null }],
        folderId: 'root-folder-id',
        driveId: 'drive-id'
      })

      expect(result).toBe(true)
      expect(client.collection).toHaveBeenCalledWith(DOCTYPE_FILES, {
        driveId: 'drive-id'
      })
    })
  })
})

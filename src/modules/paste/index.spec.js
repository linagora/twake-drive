import { handlePasteOperation } from './index'

// Mock dependencies
jest.mock('cozy-client/dist/models/file', () => ({
  isFile: jest.fn(),
  copy: jest.fn(),
  move: jest.fn()
}))

jest.mock('./utils', () => ({
  resolveNameConflictsForCut: jest.fn()
}))

jest.mock('../move/helpers', () => ({
  hasOneOfEntriesShared: jest.fn()
}))

jest.mock('../../lib/logger', () => ({
  error: jest.fn(),
  info: jest.fn()
}))

const { isFile, copy, move } = require('cozy-client/dist/models/file')

const { resolveNameConflictsForCut } = require('./utils')
const { hasOneOfEntriesShared } = require('../move/helpers')

describe('handlePasteOperation', () => {
  let mockClient, mockFiles, mockTargetFolder, mockSourceDirectory, mockOptions

  beforeEach(() => {
    mockClient = {
      save: jest.fn(),
      query: jest.fn(),
      collection: jest.fn(() => ({
        updateFile: jest.fn(),
        update: jest.fn().mockResolvedValue({ data: { _id: 'updated-file' } })
      }))
    }

    mockFiles = [
      {
        _id: 'file1',
        name: 'test1.txt',
        type: 'file',
        attributes: { name: 'test1.txt' }
      },
      {
        _id: 'file2',
        name: 'test2.txt',
        type: 'file',
        attributes: { name: 'test2.txt' }
      }
    ]

    mockTargetFolder = {
      _id: 'target-folder',
      name: 'Target Folder',
      path: '/Target Folder'
    }

    mockSourceDirectory = {
      _id: 'source-folder',
      name: 'Source Folder',
      path: '/Source Folder'
    }

    mockOptions = {
      showAlert: jest.fn(),
      t: jest.fn(key => key),
      sharingContext: {}
    }

    // Default mocks
    isFile.mockReturnValue(true)
    copy.mockResolvedValue({ data: { _id: 'copied-file' } })
    move.mockResolvedValue({ data: { _id: 'moved-file' } })
    resolveNameConflictsForCut.mockResolvedValue(mockFiles)
    hasOneOfEntriesShared.mockReturnValue(false)

    jest.clearAllMocks()
  })

  describe('Copy Operations', () => {
    it('should copy files successfully', async () => {
      const result = await handlePasteOperation(
        mockClient,
        mockFiles,
        'copy',
        null, // sourceDirectory
        mockTargetFolder,
        mockOptions
      )

      expect(copy).toHaveBeenCalledTimes(2)
      expect(copy).toHaveBeenCalledWith(
        mockClient,
        mockFiles[0],
        mockTargetFolder
      )
      expect(copy).toHaveBeenCalledWith(
        mockClient,
        mockFiles[1],
        mockTargetFolder
      )

      expect(result).toEqual([
        {
          success: true,
          file: { data: { _id: 'copied-file' } },
          operation: 'copy'
        },
        {
          success: true,
          file: { data: { _id: 'copied-file' } },
          operation: 'copy'
        }
      ])
    })

    it('should not resolve name conflicts for copy operations', async () => {
      await handlePasteOperation(
        mockClient,
        mockFiles,
        'copy',
        null, // sourceDirectory
        mockTargetFolder,
        mockOptions
      )

      expect(resolveNameConflictsForCut).not.toHaveBeenCalled()
    })
  })

  describe('Cut Operations', () => {
    it('should move files successfully', async () => {
      const result = await handlePasteOperation(
        mockClient,
        mockFiles,
        'cut',
        mockSourceDirectory,
        mockTargetFolder,
        mockOptions
      )

      expect(resolveNameConflictsForCut).toHaveBeenCalledWith(
        mockClient,
        mockFiles,
        mockTargetFolder,
        undefined
      )

      expect(move).toHaveBeenCalledTimes(2)
      expect(move).toHaveBeenCalledWith(
        mockClient,
        mockFiles[0],
        mockTargetFolder,
        { force: false }
      )
      expect(move).toHaveBeenCalledWith(
        mockClient,
        mockFiles[1],
        mockTargetFolder,
        { force: false }
      )

      expect(result).toEqual([
        {
          success: true,
          file: { data: { _id: 'moved-file' } },
          operation: 'move'
        },
        {
          success: true,
          file: { data: { _id: 'moved-file' } },
          operation: 'move'
        }
      ])
    })

    it('should use resolved names for cut operations', async () => {
      const resolvedFiles = [
        {
          ...mockFiles[0],
          needsRename: true,
          uniqueName: 'test1 (1).txt',
          attributes: { name: 'test1 (1).txt' },
          _rev: 'rev1',
          meta: { rev: 'rev1' }
        },
        {
          ...mockFiles[1],
          needsRename: false,
          uniqueName: 'test2.txt',
          attributes: { name: 'test2.txt' }
        }
      ]

      resolveNameConflictsForCut.mockResolvedValue(resolvedFiles)

      await handlePasteOperation(
        mockClient,
        mockFiles,
        'cut',
        mockSourceDirectory,
        mockTargetFolder,
        mockOptions
      )

      expect(move).toHaveBeenCalledTimes(2)
      expect(move).toHaveBeenCalledWith(
        mockClient,
        resolvedFiles[0],
        mockTargetFolder,
        { force: false }
      )
      expect(move).toHaveBeenCalledWith(
        mockClient,
        resolvedFiles[1],
        mockTargetFolder,
        { force: false }
      )
    })
  })

  describe('Sharing Context', () => {
    it('should handle shared files with sharing context', async () => {
      hasOneOfEntriesShared.mockReturnValue(true)

      const sharingContext = {
        showMoveValidationModal: jest.fn(),
        hideMoveValidationModal: jest.fn()
      }

      mockOptions.sharingContext = sharingContext

      await handlePasteOperation(
        mockClient,
        mockFiles,
        'cut',
        mockSourceDirectory,
        mockTargetFolder,
        mockOptions
      )

      // Should still process files normally
      expect(move).toHaveBeenCalledTimes(2)
    })

    it('should handle files without sharing context when shared', async () => {
      hasOneOfEntriesShared.mockReturnValue(true)

      // No sharing context provided
      delete mockOptions.sharingContext

      const result = await handlePasteOperation(
        mockClient,
        mockFiles,
        'cut',
        mockSourceDirectory,
        mockTargetFolder,
        mockOptions
      )

      // Should still process files
      expect(result).toHaveLength(2)
      expect(move).toHaveBeenCalledTimes(2)
    })
  })

  describe('Nextcloud Integration', () => {
    it('should handle Nextcloud files', async () => {
      const nextcloudFiles = [
        {
          _id: 'nextcloud-file',
          name: 'nextcloud.txt',
          type: 'file',
          attributes: { name: 'nextcloud.txt' },
          cozyMetadata: { sourceAccount: 'nextcloud-account' }
        }
      ]

      await handlePasteOperation(
        mockClient,
        nextcloudFiles,
        'copy',
        null, // sourceDirectory
        mockTargetFolder,
        mockOptions
      )

      expect(copy).toHaveBeenCalledWith(
        mockClient,
        nextcloudFiles[0],
        mockTargetFolder
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty files array', async () => {
      const result = await handlePasteOperation(
        mockClient,
        [],
        'copy',
        null, // sourceDirectory
        mockTargetFolder,
        mockOptions
      )

      expect(result).toEqual([])
      expect(copy).not.toHaveBeenCalled()
      expect(move).not.toHaveBeenCalled()
    })

    it('should handle null files array', async () => {
      await expect(
        handlePasteOperation(
          mockClient,
          null,
          'copy',
          null, // sourceDirectory
          mockTargetFolder,
          mockOptions
        )
      ).rejects.toThrow('processedFiles is not iterable')

      expect(copy).not.toHaveBeenCalled()
    })

    it('should handle invalid operation type', async () => {
      const result = await handlePasteOperation(
        mockClient,
        mockFiles,
        'invalid-operation',
        null, // sourceDirectory
        mockTargetFolder,
        mockOptions
      )

      // Should default to no operation
      expect(result).toEqual([])
      expect(copy).not.toHaveBeenCalled()
      expect(move).not.toHaveBeenCalled()
    })

    it('should handle missing target folder', async () => {
      const result = await handlePasteOperation(
        mockClient,
        mockFiles,
        'copy',
        null, // sourceDirectory
        null, // targetFolder
        mockOptions
      )

      // Should return error results for each file
      expect(result).toHaveLength(2)
      expect(result[0].success).toBe(false)
      expect(result[1].success).toBe(false)
      expect(result[0].error).toBeInstanceOf(Error)
      expect(result[1].error).toBeInstanceOf(Error)
      expect(copy).toHaveBeenCalledTimes(2)
    })

    it('should handle missing options', async () => {
      const result = await handlePasteOperation(
        mockClient,
        mockFiles,
        'copy',
        null, // sourceDirectory
        mockTargetFolder
      )

      // Should still work without options
      expect(result).toHaveLength(2)
      expect(copy).toHaveBeenCalledTimes(2)
    })
  })

  describe('Mixed File Types', () => {
    it('should handle both files and folders', async () => {
      const mixedFiles = [
        {
          _id: 'file1',
          name: 'test.txt',
          type: 'file',
          attributes: { name: 'test.txt' }
        },
        {
          _id: 'folder1',
          name: 'Test Folder',
          type: 'directory',
          attributes: { name: 'Test Folder' }
        }
      ]

      isFile.mockImplementation(item => item.type === 'file')

      const result = await handlePasteOperation(
        mockClient,
        mixedFiles,
        'copy',
        null, // sourceDirectory
        mockTargetFolder,
        mockOptions
      )

      expect(copy).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(1)
      expect(result.every(r => r.success)).toBe(true)
    })
  })
})

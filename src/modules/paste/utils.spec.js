import {
  generateUniqueNameWithSuffix,
  resolveNameConflictsForCut
} from './utils'

jest.mock('cozy-client/dist/models/file', () => ({
  isFile: jest.fn()
}))

const { isFile } = require('cozy-client/dist/models/file')

describe('generateUniqueNameWithSuffix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('File naming', () => {
    beforeEach(() => {
      isFile.mockReturnValue(true)
    })

    it('should return original name if no conflict', () => {
      const existingNames = new Set(['other.txt'])
      const result = generateUniqueNameWithSuffix(
        'test.txt',
        existingNames,
        true
      )
      expect(result).toBe('test.txt')
    })

    it('should add suffix for conflicting file names', () => {
      const existingNames = new Set(['test.txt'])
      const result = generateUniqueNameWithSuffix(
        'test.txt',
        existingNames,
        true
      )
      expect(result).toBe('test (1).txt')
    })

    it('should increment suffix for multiple conflicts', () => {
      const existingNames = new Set([
        'test.txt',
        'test (1).txt',
        'test (2).txt'
      ])
      const result = generateUniqueNameWithSuffix(
        'test.txt',
        existingNames,
        true
      )
      expect(result).toBe('test (3).txt')
    })

    it('should continue from existing suffix', () => {
      const existingNames = new Set(['test (2).txt', 'test (3).txt'])
      const result = generateUniqueNameWithSuffix(
        'test (2).txt',
        existingNames,
        true
      )
      expect(result).toBe('test (4).txt')
    })
  })

  describe('Folder naming', () => {
    beforeEach(() => {
      isFile.mockReturnValue(false)
    })

    it('should return original name if no conflict', () => {
      const existingNames = new Set(['Other Folder'])
      const result = generateUniqueNameWithSuffix(
        'Test Folder',
        existingNames,
        false
      )
      expect(result).toBe('Test Folder')
    })

    it('should add suffix for conflicting folder names', () => {
      const existingNames = new Set(['Test Folder'])
      const result = generateUniqueNameWithSuffix(
        'Test Folder',
        existingNames,
        false
      )
      expect(result).toBe('Test Folder (1)')
    })

    it('should increment suffix for multiple conflicts', () => {
      const existingNames = new Set([
        'Test Folder',
        'Test Folder (1)',
        'Test Folder (2)'
      ])
      const result = generateUniqueNameWithSuffix(
        'Test Folder',
        existingNames,
        false
      )
      expect(result).toBe('Test Folder (3)')
    })

    it('should continue from existing suffix for folders', () => {
      const existingNames = new Set(['Test Folder (5)', 'Test Folder (6)'])
      const result = generateUniqueNameWithSuffix(
        'Test Folder (5)',
        existingNames,
        false
      )
      expect(result).toBe('Test Folder (7)')
    })
  })
})

describe('resolveNameConflictsForCut', () => {
  let mockClient

  beforeEach(() => {
    const mockStatById = jest.fn()
    mockClient = {
      query: jest.fn(),
      collection: jest.fn(() => ({
        statById: mockStatById
      }))
    }
    // Store reference to statById mock for easy access in tests
    mockClient.mockStatById = mockStatById

    isFile.mockImplementation(file => file.type === 'file')
    jest.clearAllMocks()
  })

  it('should resolve conflicts for files', async () => {
    const files = [
      {
        _id: 'file1',
        name: 'test.txt',
        type: 'file',
        attributes: { name: 'test.txt' }
      },
      {
        _id: 'file2',
        name: 'document.pdf',
        type: 'file',
        attributes: { name: 'document.pdf' }
      }
    ]

    const existingItems = [{ name: 'test.txt' }, { name: 'other.txt' }]

    mockClient.query.mockResolvedValue({ data: existingItems })

    const targetFolder = { _id: 'target-folder' }
    const result = await resolveNameConflictsForCut(
      mockClient,
      files,
      targetFolder
    )

    expect(result).toHaveLength(2)

    // First file should be renamed due to conflict
    expect(result[0].needsRename).toBe(true)
    expect(result[0].uniqueName).toBe('test (1).txt')
    expect(result[0].attributes.name).toBe('test (1).txt')

    // Second file should not be renamed (no conflict)
    expect(result[1].needsRename).toBe(false)
    expect(result[1].uniqueName).toBe('document.pdf')
    expect(result[1].attributes.name).toBe('document.pdf')
  })

  it('should resolve conflicts for folders', async () => {
    const folders = [
      {
        _id: 'folder1',
        name: 'Documents',
        type: 'directory',
        attributes: { name: 'Documents' }
      }
    ]

    const existingItems = [{ name: 'Documents' }, { name: 'Pictures' }]

    mockClient.query.mockResolvedValue({ data: existingItems })

    const targetFolder = { _id: 'target-folder' }
    const result = await resolveNameConflictsForCut(
      mockClient,
      folders,
      targetFolder
    )

    expect(result).toHaveLength(1)
    expect(result[0].needsRename).toBe(true)
    expect(result[0].uniqueName).toBe('Documents (1)')
    expect(result[0].attributes.name).toBe('Documents (1)')
  })

  describe('Public mode (isPublic=true)', () => {
    it('should resolve conflicts for files in public mode', async () => {
      const files = [
        {
          _id: 'file1',
          name: 'test.txt',
          type: 'file',
          attributes: { name: 'test.txt' }
        },
        {
          _id: 'file2',
          name: 'document.pdf',
          type: 'file',
          attributes: { name: 'document.pdf' }
        }
      ]

      const existingItems = [{ name: 'test.txt' }, { name: 'other.txt' }]

      mockClient.mockStatById.mockResolvedValue({
        included: existingItems
      })

      const targetFolder = { _id: 'target-folder' }
      const result = await resolveNameConflictsForCut(
        mockClient,
        files,
        targetFolder,
        true
      )

      expect(result).toHaveLength(2)

      // First file should be renamed due to conflict
      expect(result[0].needsRename).toBe(true)
      expect(result[0].uniqueName).toBe('test (1).txt')
      expect(result[0].attributes.name).toBe('test (1).txt')

      // Second file should not be renamed (no conflict)
      expect(result[1].needsRename).toBe(false)
      expect(result[1].uniqueName).toBe('document.pdf')
      expect(result[1].attributes.name).toBe('document.pdf')

      // Should use collection.statById method for public mode
      expect(mockClient.collection).toHaveBeenCalledWith('io.cozy.files')
      expect(mockClient.mockStatById).toHaveBeenCalledWith('target-folder')
      expect(mockClient.query).not.toHaveBeenCalled()
    })

    it('should resolve conflicts for folders in public mode', async () => {
      const folders = [
        {
          _id: 'folder1',
          name: 'Documents',
          type: 'directory',
          attributes: { name: 'Documents' }
        }
      ]

      const existingItems = [{ name: 'Documents' }, { name: 'Pictures' }]

      mockClient.mockStatById.mockResolvedValue({
        included: existingItems
      })

      const targetFolder = { _id: 'target-folder' }
      const result = await resolveNameConflictsForCut(
        mockClient,
        folders,
        targetFolder,
        true
      )

      expect(result).toHaveLength(1)
      expect(result[0].needsRename).toBe(true)
      expect(result[0].uniqueName).toBe('Documents (1)')
      expect(result[0].attributes.name).toBe('Documents (1)')

      // Should use collection.statById method for public mode
      expect(mockClient.collection).toHaveBeenCalledWith('io.cozy.files')
      expect(mockClient.mockStatById).toHaveBeenCalledWith('target-folder')
      expect(mockClient.query).not.toHaveBeenCalled()
    })
  })
})

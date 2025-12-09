import { renderHook } from '@testing-library/react-hooks'

import { useFileSorting } from './useFileSorting'

// Mock des dépendances
jest.mock('@/hooks', () => ({
  useFolderSort: jest.fn(() => [
    { order: 'asc', attribute: 'name' },
    jest.fn(),
    true
  ])
}))

jest.mock('cozy-ui/transpiled/react/Table/Virtualized/helpers', () => ({
  stableSort: jest.fn((data, comparator) => [...data].sort(comparator)),
  getComparator: jest.fn((order, orderBy) => (a, b) => {
    if (order === 'asc') {
      return a[orderBy]?.localeCompare(b[orderBy])
    }
    return b[orderBy]?.localeCompare(a[orderBy])
  })
}))

describe('useFileSorting', () => {
  const mockQueryResults = [
    {
      data: [
        {
          _id: '1',
          name: 'file-b.txt',
          type: 'file',
          updated_at: '2023-01-01T10:00:00Z'
        },
        {
          _id: '2',
          name: 'file-a.txt',
          type: 'file',
          updated_at: '2023-01-01T11:00:00Z'
        },
        {
          _id: '3',
          name: 'folder-c',
          type: 'directory',
          updated_at: '2023-01-01T12:00:00Z'
        }
      ]
    }
  ]

  const mockOrderProps = {
    sortOrder: { order: 'desc', attribute: 'updated_at' },
    setOrder: jest.fn(),
    isSettingsLoaded: true
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should extract all files from query results', () => {
    const { result } = renderHook(() =>
      useFileSorting('folder-1', mockQueryResults, {})
    )

    expect(result.current.allFiles).toHaveLength(3)
    expect(result.current.allFiles[0]._id).toBe('1')
  })

  it('should use internal sort order when no orderProps provided', () => {
    const { result } = renderHook(() =>
      useFileSorting('folder-1', mockQueryResults, {})
    )

    expect(result.current.sortOrder).toEqual({
      order: 'asc',
      attribute: 'name'
    })
  })

  it('should use external sort order when orderProps provided', () => {
    const { result } = renderHook(() =>
      useFileSorting('folder-1', mockQueryResults, mockOrderProps)
    )

    expect(result.current.sortOrder).toEqual({
      order: 'desc',
      attribute: 'updated_at'
    })
  })

  it('should apply secondary sort (directories before files)', () => {
    const { result } = renderHook(() =>
      useFileSorting(
        'folder-1',
        [
          {
            data: [
              { _id: '1', name: 'file.txt', type: 'file' },
              { _id: '2', name: 'folder', type: 'directory' }
            ]
          }
        ],
        {}
      )
    )

    // Secondary sort should put directories before files
    expect(result.current.sortedFiles[0].type).toBe('directory')
    expect(result.current.sortedFiles[1].type).toBe('file')
  })

  it('should apply both primary and secondary sort', () => {
    const { result } = renderHook(() =>
      useFileSorting('folder-1', mockQueryResults, mockOrderProps)
    )

    // Should be sorted by updated_at in descending order (most recent first), then by type
    expect(result.current.sortedFiles).toHaveLength(3)

    // Verify the actual sort ordering
    const sortedFiles = result.current.sortedFiles

    // Expected order: updated_at descending (folder-c:12:00, file-a.txt:11:00, file-b.txt:10:00)
    // Secondary sort: directories before files (folder-c should come before files)
    expect(sortedFiles[0].name).toBe('folder-c')
    expect(sortedFiles[0].type).toBe('directory')

    expect(sortedFiles[1].name).toBe('file-a.txt')
    expect(sortedFiles[1].type).toBe('file')

    expect(sortedFiles[2].name).toBe('file-b.txt')
    expect(sortedFiles[2].type).toBe('file')

    // Alternative verification: map filenames and types
    const fileInfo = sortedFiles.map(file => ({
      name: file.name,
      type: file.type
    }))
    expect(fileInfo).toEqual([
      { name: 'folder-c', type: 'directory' },
      { name: 'file-a.txt', type: 'file' },
      { name: 'file-b.txt', type: 'file' }
    ])
  })

  it('should create changeSortOrder callback', () => {
    const { result } = renderHook(() =>
      useFileSorting('folder-1', mockQueryResults, mockOrderProps)
    )

    result.current.changeSortOrder(null, 'size', 'asc')
    expect(mockOrderProps.setOrder).toHaveBeenCalledWith({
      attribute: 'size',
      order: 'asc'
    })
  })

  it('should handle empty query results', () => {
    const { result } = renderHook(() => useFileSorting('folder-1', [], {}))

    expect(result.current.allFiles).toHaveLength(0)
    expect(result.current.sortedFiles).toHaveLength(0)
  })

  it('should handle query results with empty data arrays', () => {
    const { result } = renderHook(() =>
      useFileSorting(
        'folder-1',
        [{ data: [] }, { data: null }, { data: undefined }],
        {}
      )
    )

    expect(result.current.allFiles).toHaveLength(0)
  })
})

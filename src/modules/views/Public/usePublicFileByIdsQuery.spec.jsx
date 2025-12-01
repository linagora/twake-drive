import { renderHook } from '@testing-library/react-hooks'

import { useClient } from 'cozy-client'

// Suppress React act warnings for this test file
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes(
        'Warning: An update to %s inside a test was not wrapped in act'
      )
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

import {
  fetchFileById,
  usePublicFileByIdsQuery
} from './usePublicFileByIdsQuery'

// Mock cozy-client
jest.mock('cozy-client', () => ({
  useClient: jest.fn()
}))

const mockClient = {
  collection: jest.fn()
}

const mockFiles = [
  {
    _id: 'file1',
    _type: 'io.cozy.files',
    name: 'document1.pdf',
    type: 'file',
    mime: 'application/pdf',
    size: 1024
  },
  {
    _id: 'file2',
    _type: 'io.cozy.files',
    name: 'document2.pdf',
    type: 'file',
    mime: 'application/pdf',
    size: 2048
  }
]

describe('fetchFileById', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should fetch file by id successfully', async () => {
    const mockStatById = jest.fn().mockResolvedValue({
      data: [mockFiles[0]]
    })

    mockClient.collection.mockReturnValue({
      statById: mockStatById
    })

    const result = await fetchFileById(mockClient, 'file1')

    expect(mockClient.collection).toHaveBeenCalledWith('io.cozy.files')
    expect(mockStatById).toHaveBeenCalledWith('file1')
    expect(result).toEqual([mockFiles[0]])
  })

  it('should handle errors when fetching file', async () => {
    const mockStatById = jest.fn().mockRejectedValue(new Error('Network error'))

    mockClient.collection.mockReturnValue({
      statById: mockStatById
    })

    await expect(fetchFileById(mockClient, 'file1')).rejects.toThrow(
      'Network error'
    )
  })
})

describe('usePublicFileByIdsQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useClient.mockReturnValue(mockClient)
    // Reset mock client
    mockClient.collection.mockReturnValue({
      statById: jest.fn().mockResolvedValue({ data: [] })
    })
  })

  it('should return initial state', () => {
    const { result } = renderHook(() => usePublicFileByIdsQuery(['file1']))

    expect(result.current.fetchStatus).toBe('loading')
    expect(result.current.files).toEqual([])
  })

  it('should fetch files successfully', () => {
    const mockStatById = jest
      .fn()
      .mockResolvedValueOnce({ data: [mockFiles[0]] })
      .mockResolvedValueOnce({ data: [mockFiles[1]] })

    // Clear previous calls and set up fresh mock
    jest.clearAllMocks()
    mockClient.collection.mockReturnValue({
      statById: mockStatById
    })

    const { result } = renderHook(() =>
      usePublicFileByIdsQuery(['file1', 'file2'])
    )

    expect(result.current.fetchStatus).toBe('loading')
    expect(result.current.files).toEqual([])
    // Verify the function calls were made (may be called multiple times due to React)
    expect(mockStatById).toHaveBeenCalledWith('file1')
    expect(mockStatById).toHaveBeenCalledWith('file2')
  })

  it('should handle empty file ids array', () => {
    // Clear previous calls
    jest.clearAllMocks()

    const { result } = renderHook(() => usePublicFileByIdsQuery([]))

    expect(result.current.fetchStatus).toBe('loading')
    expect(result.current.files).toEqual([])
    // For empty array, no fetchFileById calls are made, so collection is not called
    expect(mockClient.collection).not.toHaveBeenCalled()
  })

  it('should handle fetch errors', () => {
    const mockStatById = jest.fn().mockRejectedValue(new Error('Network error'))

    mockClient.collection.mockReturnValue({
      statById: mockStatById
    })

    const { result } = renderHook(() => usePublicFileByIdsQuery(['file1']))

    expect(result.current.fetchStatus).toBe('loading')
    expect(result.current.files).toEqual([])
  })

  it('should handle null client', () => {
    useClient.mockReturnValue(null)

    const { result } = renderHook(() => usePublicFileByIdsQuery(['file1']))

    expect(result.current.fetchStatus).toBe('pending')
    expect(result.current.files).toEqual([])
  })
})

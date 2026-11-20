import { act, renderHook, waitFor } from '@testing-library/react'

import { useClient } from 'cozy-client'

import useSearch from './useSearch'

import {
  indexFiles,
  isStackSearchUnavailable,
  searchFilesOnStack
} from '@/modules/search/components/helpers'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => () => ({
  isDesktop: true
}))
jest.mock('@/hooks/useDebounce', () => value => value)
jest.mock('@/modules/views/OnlyOffice/helpers', () => ({
  isOfficeEnabled: () => false
}))
jest.mock('@/modules/search/components/helpers', () => ({
  indexFiles: jest.fn(),
  isStackSearchUnavailable: jest.fn(),
  searchFilesOnStack: jest.fn()
}))

const file = id => ({
  id,
  name: `${id}.txt`,
  path: '/',
  url: `/folder/d/file/${id}`
})

describe('useSearch', () => {
  beforeEach(() => {
    useClient.mockReturnValue({})
    jest.clearAllMocks()
  })

  it('searches with the stack and fetches the next pages', async () => {
    isStackSearchUnavailable.mockReturnValue(false)
    searchFilesOnStack
      .mockResolvedValueOnce({ files: [file('a')], cursor: 'c1' })
      .mockResolvedValueOnce({ files: [file('b')], cursor: null })

    const { result } = renderHook(() => useSearch('rep', { limit: 1 }))
    await act(() => result.current.makeIndexes())
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1))
    expect(result.current.hasMore).toBe(true)
    expect(indexFiles).not.toHaveBeenCalled()

    await act(() => result.current.fetchMore())
    expect(searchFilesOnStack).toHaveBeenLastCalledWith({}, 'rep', {
      limit: 1,
      cursor: 'c1',
      officeEnabled: false
    })
    expect(result.current.suggestions.map(s => s.title)).toEqual([
      'a.txt',
      'b.txt'
    ])
    expect(result.current.hasMore).toBe(false)
  })

  it('falls back on the local index when the stack cannot search', async () => {
    isStackSearchUnavailable.mockReturnValue(true)
    searchFilesOnStack.mockResolvedValue(null)
    indexFiles.mockResolvedValue({ search: () => [file('a'), file('b')] })

    const { result } = renderHook(() => useSearch('rep', { limit: 1 }))
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1))
    expect(indexFiles).toHaveBeenCalled()
    expect(result.current.hasMore).toBe(true)

    await act(() => result.current.fetchMore())
    expect(result.current.suggestions).toHaveLength(2)
  })
})

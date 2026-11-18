import { act, renderHook, waitFor } from '@testing-library/react'

import { useClient, useQuery } from 'cozy-client'

import { usePersonalRecents } from './usePersonalRecents'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(),
  useQuery: jest.fn()
}))

const makeFile = id => ({
  _id: id,
  _type: 'io.cozy.files',
  type: 'file',
  name: `current-${id}`
})

const makeRecent = (id, { file = makeFile(id), lastActivityAt } = {}) => ({
  _id: id,
  _type: 'io.cozy.files.recents',
  type: 'file',
  name: `old-${id}`,
  last_activity_at: lastActivityAt ?? '2026-11-08T10:00:00Z',
  file: { data: file }
})

const mockQueryResult = result => {
  const queryState = {
    data: [],
    fetchStatus: 'loaded',
    lastUpdate: 1,
    hasMore: false,
    fetchMore: jest.fn(),
    ...result
  }
  useQuery.mockReturnValue(queryState)
  useClient.mockReturnValue({ getQueryFromState: () => queryState })
}

describe('usePersonalRecents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reads io.cozy.files.recents only when enabled', () => {
    mockQueryResult()

    renderHook(() => usePersonalRecents({ enabled: false }))

    const [definition, options] = useQuery.mock.calls[0]
    expect(definition().doctype).toBe('io.cozy.files.recents')
    expect(options).toMatchObject({
      as: 'io.cozy.files.recents',
      enabled: false,
      backgroundFetching: true
    })
    expect(options.fetchPolicy).toEqual(expect.any(Function))
  })

  it('returns the file of each recent, in the order of the stack', () => {
    mockQueryResult({ data: [makeRecent('b'), makeRecent('a')] })

    const { result } = renderHook(() => usePersonalRecents())

    expect(result.current.data).toEqual([makeFile('b'), makeFile('a')])
  })

  it('returns the recent itself when its file is unreadable', () => {
    const unreadable = makeRecent('gone', { file: null })
    mockQueryResult({ data: [unreadable] })

    const { result } = renderHook(() => usePersonalRecents())

    expect(result.current.data).toEqual([unreadable])
  })

  it('gives the last activity of a recent for its file', () => {
    mockQueryResult({
      data: [makeRecent('a', { lastActivityAt: '2026-11-10T08:00:00Z' })]
    })

    const { result } = renderHook(() => usePersonalRecents())

    expect(result.current.getLastActivityAt(makeFile('a'))).toBe(
      '2026-11-10T08:00:00Z'
    )
    expect(result.current.getLastActivityAt(makeFile('unknown'))).toBe(null)
  })

  it('loads the next page while the first one is empty', () => {
    const fetchMore = jest.fn()
    mockQueryResult({ data: [], hasMore: true, fetchMore })

    const { result } = renderHook(() => usePersonalRecents())

    expect(fetchMore).toHaveBeenCalledTimes(1)
    expect(result.current.fetchStatus).toBe('loading')
    expect(result.current.lastUpdate).toBe(null)
  })

  it('stays loading while the page after an empty one is fetched', () => {
    const fetchMore = jest.fn()
    mockQueryResult({
      data: [],
      hasMore: true,
      fetchStatus: 'loading',
      lastUpdate: 1,
      fetchMore
    })

    const { result } = renderHook(() => usePersonalRecents())

    expect(fetchMore).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('loading')
    expect(result.current.lastUpdate).toBe(null)
  })

  it('refetches the recents when coming back after 10 seconds', () => {
    mockQueryResult()

    renderHook(() => usePersonalRecents())

    const { fetchPolicy } = useQuery.mock.calls[0][1]
    expect(fetchPolicy({ lastUpdate: Date.now() - 11 * 1000 })).toBe(true)
    expect(fetchPolicy({ lastUpdate: Date.now() - 5 * 1000 })).toBe(false)
  })

  it('reports an empty list when there is no next page', () => {
    const fetchMore = jest.fn()
    mockQueryResult({ data: [], hasMore: false, fetchMore })

    const { result } = renderHook(() => usePersonalRecents())

    expect(fetchMore).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe('loaded')
  })

  it('loads more pages while they come back empty with a next one', async () => {
    const fetchMore = jest
      .fn()
      .mockResolvedValueOnce({ data: [], next: true })
      .mockResolvedValueOnce({ data: [], next: true })
      .mockResolvedValueOnce({ data: [makeRecent('c')], next: true })
    mockQueryResult({ data: [makeRecent('a')], hasMore: true, fetchMore })

    const { result } = renderHook(() => usePersonalRecents())
    await result.current.fetchMore()

    expect(fetchMore).toHaveBeenCalledTimes(3)
  })

  it('stops loading more at an empty last page', async () => {
    const fetchMore = jest.fn().mockResolvedValue({ data: [], next: false })
    mockQueryResult({ data: [makeRecent('a')], hasMore: true, fetchMore })

    const { result } = renderHook(() => usePersonalRecents())
    await result.current.fetchMore()

    expect(fetchMore).toHaveBeenCalledTimes(1)
  })

  it('loads more only once the refresh is over', async () => {
    const fetchMore = jest
      .fn()
      .mockResolvedValue({ data: [makeRecent('b')], next: true })
    mockQueryResult({
      data: [makeRecent('a')],
      hasMore: true,
      isFetching: true,
      fetchMore
    })

    const { result, rerender } = renderHook(() => usePersonalRecents())
    await act(() => result.current.fetchMore())

    expect(fetchMore).not.toHaveBeenCalled()

    mockQueryResult({
      data: [makeRecent('z')],
      hasMore: true,
      isFetching: false,
      fetchMore
    })
    rerender()

    await waitFor(() => expect(fetchMore).toHaveBeenCalledTimes(1))
  })

  it('does not load past an empty first page during a refresh', () => {
    const fetchMore = jest.fn()
    mockQueryResult({ data: [], hasMore: true, isFetching: true, fetchMore })

    renderHook(() => usePersonalRecents())

    expect(fetchMore).not.toHaveBeenCalled()
  })

  it('reports the error of the query', () => {
    const lastError = new Error('Not Found')
    mockQueryResult({ fetchStatus: 'failed', lastError })

    const { result } = renderHook(() => usePersonalRecents())

    expect(result.current.fetchStatus).toBe('failed')
    expect(result.current.error).toBe(lastError)
  })
})

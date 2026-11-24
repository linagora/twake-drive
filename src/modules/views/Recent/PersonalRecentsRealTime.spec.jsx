import { render, waitFor } from '@testing-library/react'
import React from 'react'

import { CozyProvider, createMockClient } from 'cozy-client'
import { initQuery, receiveQueryResult } from 'cozy-client/dist/store'

import PersonalRecentsRealTime from './PersonalRecentsRealTime'

import { buildPersonalRecentsQuery } from '@/queries'

const RECENTS_DOCTYPE = 'io.cozy.files.recents'

const makeRecent = id => ({ _id: id, id, _type: RECENTS_DOCTYPE, name: id })

const setup = ({ latestRecents = [] } = {}) => {
  const client = createMockClient({})
  const recentsQuery = buildPersonalRecentsQuery()
  client.store.dispatch(
    initQuery(RECENTS_DOCTYPE, recentsQuery.definition(), recentsQuery.options)
  )
  client.store.dispatch(
    receiveQueryResult(RECENTS_DOCTYPE, {
      data: ['a', 'b', 'c'].map(makeRecent)
    })
  )
  client.requestQuery = jest
    .fn()
    .mockResolvedValue({ data: latestRecents, next: false })
  const handlers = {}
  client.plugins.realtime = {
    subscribe: jest.fn((event, doctype, handler) => {
      handlers[event] = handler
    }),
    unsubscribe: jest.fn()
  }
  const { unmount } = render(
    <CozyProvider client={client}>
      <PersonalRecentsRealTime />
    </CozyProvider>
  )
  return { client, handlers, unmount }
}

const getRecentIds = client =>
  client.getQueryFromState(RECENTS_DOCTYPE).data.map(recent => recent._id)

describe('PersonalRecentsRealTime', () => {
  it('adds a created recent at the top, in the order of the latest page', async () => {
    const { client, handlers } = setup({
      latestRecents: ['new', 'a'].map(makeRecent)
    })

    handlers.created({ _id: 'new' })

    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['new', 'a', 'b', 'c'])
    })
    expect(client.requestQuery).toHaveBeenCalledTimes(1)
    expect(client.requestQuery.mock.calls[0][0].limit).toBe(10)
  })

  it('moves an updated recent to the top', async () => {
    const { client, handlers } = setup({
      latestRecents: ['c', 'a'].map(makeRecent)
    })

    handlers.updated({ _id: 'c' })

    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['c', 'a', 'b'])
    })
  })

  it('leaves a recent missing from the latest page to the next pages', async () => {
    const { client, handlers } = setup({
      latestRecents: ['c', 'a'].map(makeRecent)
    })

    handlers.created({ _id: 'seeded' })

    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['c', 'a', 'b'])
    })
    expect(client.requestQuery).toHaveBeenCalledTimes(1)
  })

  it('reads as many latest recents as the burst brings, up to a page', async () => {
    const { client, handlers } = setup()
    const burstIds = Array.from({ length: 120 }, (_, index) => `job-${index}`)

    handlers.created({ _id: 'single' })
    await waitFor(() => {
      expect(client.requestQuery).toHaveBeenCalledTimes(1)
    })
    burstIds.slice(0, 30).forEach(id => handlers.created({ _id: id }))
    await waitFor(() => {
      expect(client.requestQuery).toHaveBeenCalledTimes(2)
    })
    burstIds.forEach(id => handlers.created({ _id: id }))
    await waitFor(() => {
      expect(client.requestQuery).toHaveBeenCalledTimes(3)
    })

    const limits = client.requestQuery.mock.calls.map(([query]) => query.limit)
    expect(limits).toEqual([10, 30, 100])
  })

  it('removes a deleted recent without any request', () => {
    const { client, handlers } = setup()

    handlers.deleted({ _id: 'b' })

    expect(getRecentIds(client)).toEqual(['a', 'c'])
    expect(client.requestQuery).not.toHaveBeenCalled()
  })

  it('refreshes a burst of recents with one request', async () => {
    const { client, handlers } = setup({
      latestRecents: ['y', 'x', 'a'].map(makeRecent)
    })

    handlers.created({ _id: 'x' })
    handlers.created({ _id: 'y' })

    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['y', 'x', 'a', 'b', 'c'])
    })
    expect(client.requestQuery).toHaveBeenCalledTimes(1)
  })

  it('keeps out a recent deleted while the refresh is in flight', async () => {
    const { client, handlers } = setup()
    let resolveLatestRecents
    client.requestQuery.mockReturnValueOnce(
      new Promise(resolve => {
        resolveLatestRecents = resolve
      })
    )

    handlers.created({ _id: 'new' })
    await waitFor(() => {
      expect(client.requestQuery).toHaveBeenCalledTimes(1)
    })
    handlers.deleted({ _id: 'a' })
    resolveLatestRecents({ data: ['new', 'a'].map(makeRecent), next: false })

    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['new', 'b', 'c'])
    })
  })

  it('discards a refresh that completes after the view left', async () => {
    const { client, handlers, unmount } = setup()
    let resolveLatestRecents
    client.requestQuery.mockReturnValueOnce(
      new Promise(resolve => {
        resolveLatestRecents = resolve
      })
    )

    handlers.updated({ _id: 'c' })
    await waitFor(() => {
      expect(client.requestQuery).toHaveBeenCalledTimes(1)
    })
    unmount()
    resolveLatestRecents({
      data: [{ ...makeRecent('c'), name: 'stale' }],
      next: false
    })
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(getRecentIds(client)).toEqual(['a', 'b', 'c'])
    expect(client.getDocumentFromState(RECENTS_DOCTYPE, 'c').name).toBe('c')
  })

  it('reads the latest page of each refresh, not merged with the previous one', async () => {
    const { client, handlers } = setup()
    client.requestQuery
      .mockResolvedValueOnce({
        data: ['new', 'a'].map(makeRecent),
        next: false
      })
      .mockResolvedValueOnce({
        data: ['newer', 'new', 'a'].map(makeRecent),
        next: false
      })

    handlers.created({ _id: 'new' })
    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['new', 'a', 'b', 'c'])
    })
    handlers.created({ _id: 'newer' })

    await waitFor(() => {
      expect(getRecentIds(client)).toEqual(['newer', 'new', 'a', 'b', 'c'])
    })
  })
})

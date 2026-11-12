import { act, renderHook } from '@testing-library/react'
import React from 'react'

import CozyClient, { useClient } from 'cozy-client'

import {
  fetchIsNotesInstalled,
  NotesInstalledProvider,
  useIsNotesInstalled
} from './useIsNotesInstalled'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))

const makeClient = (fetchJSON: jest.Mock): CozyClient =>
  ({ getStackClient: () => ({ fetchJSON }) }) as unknown as CozyClient

const httpError = (status: number): Error =>
  Object.assign(new Error(`HTTP ${status}`), { status })

describe('fetchIsNotesInstalled', () => {
  it.each([
    {
      when: 'the app is readable',
      fetchJSON: jest.fn().mockResolvedValue({ data: {} }),
      expected: true
    },
    {
      when: 'a share link has no rule to read the app',
      fetchJSON: jest.fn().mockRejectedValue(httpError(403)),
      expected: false
    },
    {
      when: 'the stack does not know the app',
      fetchJSON: jest.fn().mockRejectedValue(httpError(404)),
      expected: false
    },
    {
      when: 'the stack fails',
      fetchJSON: jest.fn().mockRejectedValue(httpError(500)),
      expected: false
    },
    {
      when: 'the network fails',
      fetchJSON: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      expected: false
    }
  ])('is $expected when $when', async ({ fetchJSON, expected }) => {
    await expect(fetchIsNotesInstalled(makeClient(fetchJSON))).resolves.toBe(
      expected
    )
    expect(fetchJSON).toHaveBeenCalledWith('GET', '/apps/notes')
  })

  it('asks the stack once per client', async () => {
    const fetchJSON = jest.fn().mockRejectedValue(httpError(404))
    const client = makeClient(fetchJSON)

    await fetchIsNotesInstalled(client)
    await fetchIsNotesInstalled(client)

    expect(fetchJSON).toHaveBeenCalledTimes(1)
  })

  it.each([
    { when: 'the stack fails', error: httpError(500) },
    { when: 'the network fails', error: new TypeError('Failed to fetch') }
  ])('asks the stack again after $when', async ({ error }) => {
    const fetchJSON = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ data: {} })
    const client = makeClient(fetchJSON)

    await expect(fetchIsNotesInstalled(client)).resolves.toBe(false)
    await expect(fetchIsNotesInstalled(client)).resolves.toBe(true)
  })
})

it('asks the stack again when the client fails before any request', async () => {
  const fetchJSON = jest.fn().mockResolvedValue({ data: {} })
  let calls = 0
  const client = {
    getStackClient: () => {
      calls += 1
      if (calls === 1) throw new Error('No stack client yet')
      return { fetchJSON }
    }
  } as unknown as CozyClient

  await expect(fetchIsNotesInstalled(client)).resolves.toBe(false)
  await expect(fetchIsNotesInstalled(client)).resolves.toBe(true)
})

describe('NotesInstalledProvider', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('asks the stack again a bit later after a failure that is not an answer', async () => {
    jest.useFakeTimers()
    const fetchJSON = jest
      .fn()
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce({ data: {} })
    jest.mocked(useClient).mockReturnValue(makeClient(fetchJSON))

    const { result } = renderHook(() => useIsNotesInstalled(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <NotesInstalledProvider>{children}</NotesInstalledProvider>
      )
    })
    await act(async () => {})
    expect(result.current).toBe(false)

    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    await act(async () => {})
    expect(result.current).toBe(true)
  })

  it('keeps a definitive answer', async () => {
    jest.useFakeTimers()
    const fetchJSON = jest.fn().mockRejectedValue(httpError(404))
    jest.mocked(useClient).mockReturnValue(makeClient(fetchJSON))

    renderHook(() => useIsNotesInstalled(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <NotesInstalledProvider>{children}</NotesInstalledProvider>
      )
    })
    await act(async () => {})
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    await act(async () => {})
    expect(fetchJSON).toHaveBeenCalledTimes(1)
  })
})

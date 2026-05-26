import { renderHook } from '@testing-library/react'
import React from 'react'

import CozyClient from 'cozy-client'

import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

import { useFolderViewBase } from './useFolderViewBase'

const mockNavigate = jest.fn()
const mockPathname = '/test/folder'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname })
}))

jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))

describe('useFolderViewBase', () => {
  let store, client

  beforeEach(() => {
    const setup = setupStoreAndClient()
    store = setup.store
    client = setup.client
    client.plugins.realtime = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const makeWrapper = () =>
    ({ children }) =>
      (
        <AppLike store={store} client={client}>
          {children}
        </AppLike>
      )

  it('returns an object with all expected keys', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    const base = result.current

    expect(base).toHaveProperty('navigate')
    expect(base).toHaveProperty('pathname')
    expect(base).toHaveProperty('isMobile')
    expect(base).toHaveProperty('t')
    expect(base).toHaveProperty('lang')
    expect(base).toHaveProperty('client')
    expect(base).toHaveProperty('pushModal')
    expect(base).toHaveProperty('popModal')
    expect(base).toHaveProperty('dispatch')
    expect(base).toHaveProperty('showAlert')
    expect(base).toHaveProperty('isSelectionBarVisible')
    expect(base).toHaveProperty('toggleSelectAllItems')
    expect(base).toHaveProperty('isSelectAll')
  })

  it('returns the mocked navigate function', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(result.current.navigate).toBe(mockNavigate)
  })

  it('returns the mocked pathname', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(result.current.pathname).toBe(mockPathname)
  })

  it('returns a t function (translation)', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.t).toBe('function')
  })

  it('returns a lang string', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.lang).toBe('string')
  })

  it('returns a CozyClient instance as client', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(result.current.client).toBeInstanceOf(CozyClient)
  })

  it('returns pushModal and popModal as functions', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.pushModal).toBe('function')
    expect(typeof result.current.popModal).toBe('function')
  })

  it('returns dispatch as a function', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.dispatch).toBe('function')
  })

  it('returns showAlert as a function', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.showAlert).toBe('function')
  })

  it('returns isMobile as a boolean', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.isMobile).toBe('boolean')
  })

  it('returns isSelectionBarVisible as a boolean', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.isSelectionBarVisible).toBe('boolean')
  })

  it('returns toggleSelectAllItems as a function', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.toggleSelectAllItems).toBe('function')
  })

  it('returns isSelectAll as a boolean', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    expect(typeof result.current.isSelectAll).toBe('boolean')
  })

  it('has no extra unexpected keys (exact shape)', () => {
    const { result } = renderHook(() => useFolderViewBase(), {
      wrapper: makeWrapper()
    })

    const keys = Object.keys(result.current).sort()
    expect(keys).toEqual([
      'client',
      'dispatch',
      'isSelectAll',
      'isSelectionBarVisible',
      'isMobile',
      'lang',
      'navigate',
      'pathname',
      'popModal',
      'pushModal',
      'showAlert',
      't',
      'toggleSelectAllItems'
    ].sort())
  })
})
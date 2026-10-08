import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'

import { useTwakeSpace } from './SpaceLayout'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'

const HOST = 'https://space.test'

const Shown = () => {
  useTwakeSpace()
  const { pathname } = useLocation()
  return <div data-testid="pathname">{pathname}</div>
}

const fromHost = (parent, data) =>
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin: HOST, source: parent })
    )
  })

describe('useTwakeSpace', () => {
  let parent

  beforeEach(() => {
    parent = { postMessage: jest.fn() }
    Object.defineProperty(window, 'parent', {
      value: parent,
      configurable: true
    })
    window.history.replaceState(null, '', '/#/embed/sharings/d1/f1')
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      value: window,
      configurable: true
    })
  })

  const setup = () =>
    render(
      <HashRouter future={ROUTER_FUTURE_FLAGS}>
        <Routes>
          <Route path="embed/sharings/:driveId/:folderId" element={<Shown />} />
        </Routes>
      </HashRouter>
    )

  it('reports the shown drive to TwakeSpace and shows the one it loads', () => {
    const { unmount } = setup()

    fromHost(parent, { type: 'twake-embed:hello' })
    expect(parent.postMessage).toHaveBeenCalledWith(
      {
        type: 'twake-embed:path',
        resourceId: 'd1',
        path: '/f1',
        replace: true
      },
      HOST
    )

    fromHost(parent, {
      type: 'twake-embed:load',
      resourceId: 'd2',
      path: '/f9'
    })
    expect(screen.getByTestId('pathname').textContent).toBe(
      '/embed/sharings/d2/f9'
    )

    unmount()
    expect(Object.hasOwn(window.history, 'pushState')).toBe(false)
  })
})

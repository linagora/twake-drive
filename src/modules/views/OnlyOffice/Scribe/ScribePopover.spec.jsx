import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import AppLike from 'test/components/AppLike'

import { ScribePopover } from '@/modules/views/OnlyOffice/Scribe/ScribePopover'
import {
  useScribe,
  useScribeGeometry
} from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn(),
  useScribeGeometry: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Breakpoints'),
  __esModule: true,
  default: jest.fn(),
  useBreakpoints: jest.fn()
}))

const mockPopper = jest.fn()
jest.mock('cozy-ui/transpiled/react/Popper', () => ({
  __esModule: true,
  default: ({ anchorEl, placement, modifiers, open, popperRef, ...props }) => {
    mockPopper({ anchorEl, placement, modifiers, open })
    return <div {...props} />
  }
}))

const mockIntentIframe = jest.fn()
jest.mock('cozy-ui-plus/dist/Intent/IntentIframe', () => ({
  __esModule: true,
  default: props => {
    mockIntentIframe(props)
    return <div data-testid="intent-iframe" />
  }
}))

const SELECTION = {
  rect: {
    left: 358,
    top: 269,
    width: 118,
    height: 15,
    corners: [
      [358, 269],
      [358, 284],
      [476, 269],
      [476, 284]
    ]
  },
  hasText: true
}
const GEOMETRY = {
  selection: SELECTION,
  viewer: { left: 59, top: 174, width: 1167, height: 465 },
  frame: { left: 10, top: 49, width: 1280, height: 671 }
}

const setup = ({ scribe = {}, geometry = GEOMETRY, isMobile = false } = {}) => {
  const closePopover = jest.fn()
  const applyResult = jest.fn()
  useBreakpoints.mockReturnValue({ isMobile })
  const mockScribe = (changes = {}) => {
    useScribe.mockReturnValue({
      isPopoverOpen: true,
      popoverSource: 'selection',
      content: 'Un **texte**',
      target: 'selection',
      documentType: 'word',
      closePopover,
      applyResult,
      ...scribe,
      ...changes
    })
  }
  const makeTree = () => (
    <AppLike client={createMockClient({})}>
      <ScribePopover />
    </AppLike>
  )

  mockScribe()
  useScribeGeometry.mockReturnValue(geometry)
  const { rerender } = render(makeTree())

  return {
    closePopover,
    applyResult,
    rerender: ({ geometry: nextGeometry = geometry, ...changes } = {}) => {
      mockScribe(changes)
      useScribeGeometry.mockReturnValue(nextGeometry)
      rerender(makeTree())
    }
  }
}

const getPopperProps = () => mockPopper.mock.calls.at(-1)[0]
const getIntentProps = () => mockIntentIframe.mock.calls.at(-1)[0]
const queryPopover = () => screen.queryByTestId('scribe-popover')
const queryDrawer = () => screen.queryByTestId('scribe-drawer')

describe('ScribePopover', () => {
  beforeEach(() => {
    mockPopper.mockClear()
    mockIntentIframe.mockClear()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows nothing while closed', () => {
    setup({ scribe: { isPopoverOpen: false } })

    expect(queryPopover()).toBe(null)
    expect(queryDrawer()).toBe(null)
    expect(mockIntentIframe).not.toHaveBeenCalled()
  })

  it('anchors the popover to the selection rect', () => {
    setup()

    expect(
      screen.getByRole('dialog', { name: 'Scribe Menu' })
    ).toBeInTheDocument()
    const { anchorEl, placement, open } = getPopperProps()
    expect(open).toBe(true)
    expect(placement).toBe('bottom-start')
    // The rect of the selection is in pixels of the editor frame
    expect(anchorEl.getBoundingClientRect()).toMatchObject({
      left: 10 + 358,
      top: 49 + 269,
      right: 10 + 358 + 118,
      bottom: 49 + 269 + 15,
      width: 118,
      height: 15
    })
  })

  it('anchors it to the part of the selection inside the viewer, as it moves', () => {
    const { rerender } = setup()
    const { anchorEl } = getPopperProps()

    rerender({
      geometry: {
        ...GEOMETRY,
        selection: {
          ...SELECTION,
          rect: { ...SELECTION.rect, top: 150, height: 40 }
        }
      }
    })

    expect(getPopperProps().anchorEl).toBe(anchorEl)
    // The viewer starts at 174 in the frame
    expect(anchorEl.getBoundingClientRect()).toMatchObject({
      left: 10 + 358,
      top: 49 + 174,
      width: 118,
      height: 150 + 40 - 174
    })
  })

  it('places itself 12 px below the selection, and above it without room', () => {
    setup()

    expect(getPopperProps().modifiers).toMatchObject({
      offset: { offset: '0, 12' },
      flip: { behavior: ['bottom', 'top'] },
      preventOverflow: { padding: 8, boundariesElement: 'window' }
    })
  })

  it('gives the assistant its compact layout, with where it was opened from', () => {
    setup({ scribe: { popoverSource: 'editor-toolbar' } })

    expect(getIntentProps().data).toMatchObject({
      content: 'Un **texte**',
      layout: 'compact',
      source: 'editor-toolbar'
    })
    expect(getIntentProps().data).not.toHaveProperty('draft')
    expect(getIntentProps().data).not.toHaveProperty('conversation')
  })

  it('hands the results of the assistant over', () => {
    const { applyResult } = setup()

    getIntentProps().onResult({
      request: 'panel',
      draft: '',
      conversation: 'c1'
    })

    expect(applyResult).toHaveBeenCalledWith({
      request: 'panel',
      draft: '',
      conversation: 'c1'
    })
  })

  it('closes when the assistant cancels', () => {
    const { closePopover } = setup()

    getIntentProps().onCancel()

    expect(closePopover).toHaveBeenCalledTimes(1)
  })

  it('closes when the selection goes away', () => {
    const { closePopover, rerender } = setup()
    expect(closePopover).not.toHaveBeenCalled()

    rerender({ geometry: { ...GEOMETRY, selection: null } })

    expect(closePopover).toHaveBeenCalledTimes(1)
  })

  it('stays open while the plugin has given no geometry', () => {
    const { closePopover } = setup({ geometry: null })

    expect(closePopover).not.toHaveBeenCalled()
  })

  it('closes on Escape in the page', () => {
    const { closePopover } = setup()

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(closePopover).not.toHaveBeenCalled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closePopover).toHaveBeenCalledTimes(1)
  })

  it('closes on a click away, not on a click inside', () => {
    jest.useFakeTimers()
    const { closePopover } = setup()
    // The listener is only active after the click that opened it
    act(() => {
      jest.runAllTimers()
    })

    fireEvent.click(screen.getByTestId('intent-iframe'))
    expect(closePopover).not.toHaveBeenCalled()

    fireEvent.click(document.body)
    expect(closePopover).toHaveBeenCalledTimes(1)
  })

  it('shows a drawer on a small screen', () => {
    setup({ isMobile: true })

    expect(queryDrawer()).toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Scribe Menu' })
    ).toBeInTheDocument()
    expect(queryPopover()).toBe(null)
    expect(mockPopper).not.toHaveBeenCalled()
    expect(getIntentProps().data.layout).toBe('compact')
  })

  it('closes the drawer on a tap on its handle', () => {
    const { closePopover } = setup({ isMobile: true })

    fireEvent.click(screen.getByTestId('scribe-drawer-handle'))

    expect(closePopover).toHaveBeenCalledTimes(1)
  })

  it('closes the drawer on a swipe down of more than 60 px', () => {
    const { closePopover } = setup({ isMobile: true })
    const handle = screen.getByTestId('scribe-drawer-handle')

    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
    fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 160 }] })
    expect(closePopover).not.toHaveBeenCalled()

    fireEvent.touchStart(handle, { touches: [{ clientY: 100 }] })
    fireEvent.touchEnd(handle, { changedTouches: [{ clientY: 161 }] })
    expect(closePopover).toHaveBeenCalledTimes(1)
  })
})

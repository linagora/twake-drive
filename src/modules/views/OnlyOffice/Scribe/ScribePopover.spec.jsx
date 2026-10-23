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
const mockScheduleUpdate = jest.fn()
// As the Popper of cozy-ui, whose Portal mounts the content in a second
// commit, and which gives its Popper.js instance to `popperRef`
jest.mock('cozy-ui/transpiled/react/Popper', () => {
  const { useImperativeHandle, useLayoutEffect, useState } =
    jest.requireActual('react')
  const Popper = ({
    anchorEl,
    placement,
    modifiers,
    open,
    popperRef,
    ...props
  }) => {
    const [isMounted, setIsMounted] = useState(false)
    mockPopper({ anchorEl, placement, modifiers, open })
    useImperativeHandle(popperRef, () => ({
      scheduleUpdate: mockScheduleUpdate
    }))
    useLayoutEffect(() => {
      setIsMounted(true)
    }, [])
    return isMounted ? <div {...props} /> : null
  }
  return { __esModule: true, default: Popper }
})

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
    mockScheduleUpdate.mockClear()
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

    expect(applyResult).toHaveBeenCalledWith(
      {
        request: 'panel',
        draft: '',
        conversation: 'c1'
      },
      'popover'
    )
  })

  it('shows how many cells of its answer were skipped', () => {
    const dismissSkippedCells = jest.fn()
    setup({
      scribe: {
        skippedCells: { surface: 'popover', count: 3 },
        dismissSkippedCells
      }
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Table: 3 selected cells were left unchanged'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dismissSkippedCells).toHaveBeenCalledTimes(1)
  })

  it('leaves the cells skipped by an answer of the panel to the panel', () => {
    setup({ scribe: { skippedCells: { surface: 'panel', count: 3 } } })

    expect(screen.queryByRole('alert')).toBe(null)
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

  // The viewer goes from 174 to 639 in the frame
  it.each([
    ['above the viewer', { top: 100, height: 40 }],
    ['below the viewer', { top: 700, height: 15 }]
  ])('closes when the selection is scrolled %s', (_, box) => {
    const { closePopover, rerender } = setup()

    rerender({
      geometry: {
        ...GEOMETRY,
        selection: { ...SELECTION, rect: { ...SELECTION.rect, ...box } }
      }
    })

    expect(closePopover).toHaveBeenCalledTimes(1)
  })

  it('places itself again as the assistant grows', () => {
    const observed = []
    let notifyResize = null
    window.ResizeObserver = class {
      constructor(callback) {
        notifyResize = callback
      }
      observe(element) {
        observed.push(element)
      }
      disconnect() {}
    }

    try {
      setup()

      expect(observed).toHaveLength(1)
      expect(observed[0]).toContainElement(screen.getByTestId('intent-iframe'))
      act(() => notifyResize())
      expect(mockScheduleUpdate).toHaveBeenCalledTimes(1)
    } finally {
      delete window.ResizeObserver
    }
  })

  it('fades the veil in, and out once closed', () => {
    jest.useFakeTimers()
    const { rerender } = setup()
    expect(screen.queryByTestId('scribe-popover-veil')).toBeInTheDocument()

    rerender({ isPopoverOpen: false })
    expect(queryPopover()).toBe(null)
    expect(screen.queryByTestId('scribe-popover-veil')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(160)
    })
    expect(screen.queryByTestId('scribe-popover-veil')).toBe(null)
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
    fireEvent.click(
      screen
        .getByTestId('scribe-popover')
        .querySelector('.scribe-popover-arrow')
    )
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
    // The drawer has its own backdrop
    expect(screen.queryByTestId('scribe-popover-veil')).toBe(null)
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

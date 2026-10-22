import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { ScribeResizeHandle } from '@/modules/views/OnlyOffice/Scribe/ScribeResizeHandle'

const WINDOW_WIDTH = window.innerWidth

// A panel of 400 px in a window of 1280 px: its left edge is at 880
const setup = () => {
  const onResize = jest.fn()
  const { unmount } = render(
    <AppLike client={createMockClient({})}>
      <ScribeResizeHandle width={400} onResize={onResize} />
    </AppLike>
  )
  const handle = screen.getByRole('separator', { name: 'Resize the panel' })
  handle.getBoundingClientRect = () => ({ left: 880 })

  return { onResize, handle, unmount }
}

const expectTextSelectable = isSelectable => {
  expect(document.body.style.userSelect).toBe(isSelectable ? '' : 'none')
  expect(document.body.style.cursor).toBe(isSelectable ? '' : 'col-resize')
}

describe('ScribeResizeHandle', () => {
  // jsdom has no PointerEvent: without it, the events lose their clientX
  beforeAll(() => {
    window.PointerEvent = window.MouseEvent
  })
  afterAll(() => {
    delete window.PointerEvent
  })
  beforeEach(() => {
    window.innerWidth = 1280
  })
  afterEach(() => {
    window.innerWidth = WINDOW_WIDTH
  })

  it('is a vertical separator that takes the focus, with the width of the panel', () => {
    const { handle } = setup()

    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('tabindex', '0')
    expect(handle).toHaveAttribute('aria-valuenow', '400')
    expect(handle).toHaveAttribute('aria-valuemin', '280')
    expect(handle).toHaveAttribute('aria-valuemax', '768')
  })

  it('gives where the edge of the panel goes while it is dragged, wherever it was grabbed', () => {
    const { onResize, handle } = setup()

    fireEvent.pointerMove(handle, { clientX: 700 })
    expect(onResize).not.toHaveBeenCalled()

    fireEvent.pointerDown(handle, { clientX: 886, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 866, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 786, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 786, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 600, pointerId: 1 })

    expect(onResize.mock.calls).toEqual([[860], [780]])
  })

  it('is not dragged with another button than the main one', () => {
    const { onResize, handle } = setup()

    fireEvent.pointerDown(handle, { clientX: 886, button: 2, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 786, pointerId: 1 })

    expect(onResize).not.toHaveBeenCalled()
    expectTextSelectable(true)
  })

  it.each([
    ['released outside of it', () => fireEvent.pointerUp(window)],
    ['cancelled', handle => fireEvent.pointerCancel(handle)],
    ['losing the capture', handle => fireEvent.lostPointerCapture(handle)]
  ])(
    'keeps the text from being selected while it is dragged, until %s',
    (_, endDrag) => {
      const { onResize, handle } = setup()

      fireEvent.pointerDown(handle, { clientX: 886, pointerId: 1 })
      expectTextSelectable(false)

      endDrag(handle)
      fireEvent.pointerMove(handle, { clientX: 786, pointerId: 1 })

      expectTextSelectable(true)
      expect(onResize).not.toHaveBeenCalled()
    }
  )

  it('lets the text be selected again when it is removed while dragged', () => {
    const { handle, unmount } = setup()

    fireEvent.pointerDown(handle, { clientX: 886, pointerId: 1 })
    unmount()

    expectTextSelectable(true)
  })

  it('moves the edge of the panel from the keyboard', () => {
    const { onResize, handle } = setup()

    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })
    fireEvent.keyDown(handle, { key: 'Home' })
    fireEvent.keyDown(handle, { key: 'End' })
    fireEvent.keyDown(handle, { key: 'Enter' })

    expect(onResize.mock.calls).toEqual([
      [864],
      [816],
      [896],
      [944],
      [1280],
      [0]
    ])
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { ScribeResizeHandle } from '@/modules/views/OnlyOffice/Scribe/ScribeResizeHandle'

const setup = () => {
  const onResize = jest.fn()
  const { unmount } = render(
    <AppLike client={createMockClient({})}>
      <ScribeResizeHandle onResize={onResize} />
    </AppLike>
  )
  const handle = screen.getByRole('separator', { name: 'Resize the panel' })

  return { onResize, handle, unmount }
}

describe('ScribeResizeHandle', () => {
  // jsdom has no PointerEvent: without it, the events lose their clientX
  beforeAll(() => {
    window.PointerEvent = window.MouseEvent
  })
  afterAll(() => {
    delete window.PointerEvent
  })

  it('is a vertical separator', () => {
    const { handle } = setup()

    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('gives the position of the pointer while it is dragged', () => {
    const { onResize, handle } = setup()

    fireEvent.pointerMove(handle, { clientX: 700 })
    expect(onResize).not.toHaveBeenCalled()

    fireEvent.pointerDown(handle, { clientX: 620, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 600, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 520, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientX: 520, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 400, pointerId: 1 })

    expect(onResize.mock.calls).toEqual([[600], [520]])
  })

  it('keeps the text from being selected while it is dragged', () => {
    const { handle } = setup()

    fireEvent.pointerDown(handle, { clientX: 620, pointerId: 1 })

    expect(document.body.style.userSelect).toBe('none')
    expect(document.body.style.cursor).toBe('col-resize')

    fireEvent.pointerCancel(handle, { pointerId: 1 })

    expect(document.body.style.userSelect).toBe('')
    expect(document.body.style.cursor).toBe('')
  })

  it('gives the text back when it goes while dragged', () => {
    const { handle, unmount } = setup()

    fireEvent.pointerDown(handle, { clientX: 620, pointerId: 1 })
    unmount()

    expect(document.body.style.userSelect).toBe('')
    expect(document.body.style.cursor).toBe('')
  })
})

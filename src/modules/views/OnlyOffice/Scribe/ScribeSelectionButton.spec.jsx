import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  useScribe,
  useScribeGeometry
} from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'
import { ScribeSelectionButton } from '@/modules/views/OnlyOffice/Scribe/ScribeSelectionButton'

jest.mock('cozy-flags')
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn(),
  useScribeGeometry: jest.fn()
}))

const makeSelection = end => ({
  rect: {
    left: 358,
    top: 269,
    width: end[0] - 358,
    height: end[1] - 269,
    corners: [[358, 269], [358, 284], [end[0], 269], end]
  },
  hasText: true
})
const GEOMETRY = {
  selection: makeSelection([476, 284]),
  viewer: { left: 59, top: 174, width: 1167, height: 465 },
  frame: { left: 10, top: 49, width: 1280, height: 671 }
}

const setup = ({
  scribe = {},
  isPublic = false,
  isReadOnly = false,
  isAssistantEnabled = true
} = {}) => {
  const open = jest.fn()
  flag.mockImplementation(
    name => name === 'cozy.assistant.enabled' && isAssistantEnabled
  )
  const { geometry = GEOMETRY, ...state } = scribe
  useScribe.mockReturnValue({
    isAvailable: true,
    open,
    ...state
  })
  useScribeGeometry.mockReturnValue(geometry)

  // A new element each time: React skips the same one
  const makeView = () => (
    <AppLike client={createMockClient({})}>
      <OnlyOfficeContext.Provider value={{ isPublic, isReadOnly }}>
        <ScribeSelectionButton />
      </OnlyOfficeContext.Provider>
    </AppLike>
  )
  const { rerender } = render(makeView())
  const wait = ms =>
    act(() => {
      jest.advanceTimersByTime(ms)
    })
  // The selection has kept its size long enough for the button
  wait(SETTLE_DELAY)
  const changeGeometry = next => {
    useScribeGeometry.mockReturnValue(next)
    rerender(makeView())
  }

  return { open, wait, changeGeometry }
}

const SETTLE_DELAY = 400

const queryButton = () =>
  screen.queryByRole('button', { name: 'Help me write' })

describe('ScribeSelectionButton', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('waits for the selection to keep its size before it shows', () => {
    const { wait, changeGeometry } = setup({ scribe: { geometry: null } })

    // A triple click: the word, then its paragraph
    changeGeometry(GEOMETRY)
    wait(SETTLE_DELAY - 1)
    expect(queryButton()).toBe(null)
    const paragraph = { ...GEOMETRY, selection: makeSelection([700, 299]) }
    changeGeometry(paragraph)
    wait(SETTLE_DELAY - 1)
    expect(queryButton()).toBe(null)

    wait(1)
    expect(queryButton()).toBeInTheDocument()
    expect(screen.getByTestId('scribe-selection-button').style.left).toBe(
      `${10 + 700 + 4 - 12}px`
    )
  })

  it('follows a scroll at once, the selection keeping its size', () => {
    const { changeGeometry } = setup()
    const { rect } = GEOMETRY.selection
    const scrolled = {
      ...GEOMETRY,
      selection: {
        ...GEOMETRY.selection,
        rect: {
          ...rect,
          top: rect.top - 50,
          corners: rect.corners.map(([x, y]) => [x, y - 50])
        }
      }
    }

    changeGeometry(scrolled)

    expect(queryButton()).toBeInTheDocument()
    expect(screen.getByTestId('scribe-selection-button').style.top).toBe(
      `${49 + 284 - 50 + 4 - 9}px`
    )
  })

  it('waits again for another selection of the same size', () => {
    const { wait, changeGeometry } = setup()

    changeGeometry({ ...GEOMETRY, selection: null })
    wait(0)
    changeGeometry(GEOMETRY)

    expect(queryButton()).toBe(null)
    wait(SETTLE_DELAY)
    expect(queryButton()).toBeInTheDocument()
  })

  it('shows the button at the end corner of the selection', () => {
    setup()

    expect(queryButton()).toBeInTheDocument()
    const { style } = screen.getByTestId('scribe-selection-button')
    // The disc is 4 px below and right of the corner, 12 px and 9 px inside
    // the asset
    expect(style.left).toBe(`${10 + 476 + 4 - 12}px`)
    expect(style.top).toBe(`${49 + 284 + 4 - 9}px`)
  })

  it('hides it for a cursor alone', () => {
    setup({ scribe: { geometry: { ...GEOMETRY, selection: null } } })

    expect(queryButton()).toBe(null)
  })

  it('hides it for a selection without text', () => {
    setup({
      scribe: {
        geometry: {
          ...GEOMETRY,
          selection: { ...GEOMETRY.selection, hasText: false }
        }
      }
    })

    expect(queryButton()).toBe(null)
  })

  it('hides it without a geometry', () => {
    setup({ scribe: { geometry: null } })

    expect(queryButton()).toBe(null)
  })

  it.each([
    ['below the viewer', [476, 620]],
    ['above the viewer', [476, 150]],
    ['right of the viewer', [1210, 284]]
  ])('hides it when the disc would leave the viewer, %s', (_, end) => {
    setup({
      scribe: { geometry: { ...GEOMETRY, selection: makeSelection(end) } }
    })

    expect(queryButton()).toBe(null)
  })

  it('opens the panel with the selection source on click', () => {
    const { open } = setup()

    fireEvent.click(queryButton())

    expect(open).toHaveBeenCalledWith({ source: 'selection' })
  })

  it('shows it while the panel is open, to work on the selection', () => {
    setup({ scribe: { isOpen: true } })

    expect(queryButton()).toBeInTheDocument()
  })

  it.each([
    [
      'without the plugin of the Document Server',
      { scribe: { isAvailable: false } }
    ],
    ['on a public page', { isPublic: true }],
    ['on a document the user cannot change', { isReadOnly: true }],
    ['without the assistant', { isAssistantEnabled: false }]
  ])('is not shown %s', (_, options) => {
    setup(options)

    expect(queryButton()).toBe(null)
  })
})

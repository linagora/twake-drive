import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { ScribeFloatingButton } from '@/modules/views/OnlyOffice/Scribe/ScribeFloatingButton'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

const mockPlay = jest.fn()
const mockGoToAndStop = jest.fn()

jest.mock('cozy-flags')
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn()
}))
// lottie-web draws on a canvas that jsdom does not have
jest.mock('lottie-react', () => {
  const { useImperativeHandle } = jest.requireActual('react')
  const Lottie = ({ lottieRef }) => {
    useImperativeHandle(lottieRef, () => ({
      play: mockPlay,
      goToAndStop: mockGoToAndStop
    }))
    return null
  }
  return { __esModule: true, default: Lottie }
})

const GEOMETRY = {
  selection: null,
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
  const close = jest.fn()
  flag.mockImplementation(
    name => name === 'cozy.assistant.enabled' && isAssistantEnabled
  )
  const mockScribe = changes => {
    useScribe.mockReturnValue({
      isAvailable: true,
      isOpen: false,
      geometry: GEOMETRY,
      open,
      close,
      ...scribe,
      ...changes
    })
  }
  const makeTree = () => (
    <AppLike client={createMockClient({})}>
      <OnlyOfficeContext.Provider value={{ isPublic, isReadOnly }}>
        <ScribeFloatingButton />
      </OnlyOfficeContext.Provider>
    </AppLike>
  )

  mockScribe()
  const { rerender } = render(makeTree())

  return {
    open,
    close,
    rerender: changes => {
      mockScribe(changes)
      rerender(makeTree())
    }
  }
}

const queryButton = () => screen.queryByRole('button', { name: 'Scribe Panel' })
const getZone = () => screen.getByTestId('scribe-floating-button')

describe('ScribeFloatingButton', () => {
  afterEach(() => {
    delete window.matchMedia
  })

  it('places the button at the top right of the document area', () => {
    setup()

    expect(queryButton()).toBeInTheDocument()
    const { style } = getZone()
    // 12 px inside the right and top edges of the viewer, 48 px wide
    expect(style.left).toBe(`${10 + 59 + 1167 - 12 - 48}px`)
    expect(style.top).toBe(`${49 + 174 + 12}px`)
  })

  it('keeps the button inside the left edge of a narrow document area', () => {
    setup({
      scribe: {
        geometry: {
          ...GEOMETRY,
          viewer: { ...GEOMETRY.viewer, width: 40 }
        }
      }
    })

    expect(getZone().style.left).toBe(`${10 + 59 + 12}px`)
  })

  it.each([
    ['without geometry', null],
    ['without a viewer', { ...GEOMETRY, viewer: null }]
  ])('falls back to the bottom right %s', (_, geometry) => {
    setup({ scribe: { geometry } })

    expect(queryButton()).toBeInTheDocument()
    const zone = getZone()
    expect(zone.style.left).toBe('')
    expect(zone.style.top).toBe('')
    expect(zone).toHaveClass('scribe-floating-button--corner')
  })

  it('toggles the panel', () => {
    const { open, close, rerender } = setup()

    fireEvent.click(queryButton())
    expect(open).toHaveBeenCalledWith({ source: 'floating' })
    expect(close).not.toHaveBeenCalled()

    rerender({ isOpen: true })
    expect(queryButton()).toBeInTheDocument()
    fireEvent.click(queryButton())
    expect(close).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('plays its mark while the pointer is over it', () => {
    setup()

    fireEvent.mouseEnter(queryButton())
    expect(mockPlay).toHaveBeenCalledTimes(1)

    fireEvent.mouseLeave(queryButton())
    expect(mockGoToAndStop).toHaveBeenCalledWith(0)
  })

  it('keeps its mark still for a user who asks for less motion', () => {
    window.matchMedia = query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addListener: () => {},
      removeListener: () => {}
    })
    setup()

    fireEvent.mouseEnter(queryButton())

    expect(mockPlay).not.toHaveBeenCalled()
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

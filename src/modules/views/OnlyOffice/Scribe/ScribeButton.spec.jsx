import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { ScribeButton } from '@/modules/views/OnlyOffice/Scribe/ScribeButton'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('cozy-flags')
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn()
}))

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
  useScribe.mockReturnValue({
    isAvailable: true,
    isOpen: false,
    open,
    close,
    ...scribe
  })

  render(
    <AppLike client={createMockClient({})}>
      <OnlyOfficeContext.Provider value={{ isPublic, isReadOnly }}>
        <ScribeButton />
      </OnlyOfficeContext.Provider>
    </AppLike>
  )

  return { open, close }
}

const queryButton = () =>
  screen.queryByRole('button', { name: 'Help me write' })

describe('ScribeButton', () => {
  it('opens the scribe', () => {
    const { open } = setup()

    fireEvent.click(queryButton())

    expect(open).toHaveBeenCalled()
    expect(queryButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('closes the scribe when it is open', () => {
    const { open, close } = setup({ scribe: { isOpen: true } })

    fireEvent.click(queryButton())

    expect(close).toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(queryButton().getAttribute('aria-pressed')).toBe('true')
  })

  it('is not shown without the plugin of the Document Server', () => {
    setup({ scribe: { isAvailable: false } })

    expect(queryButton()).toBe(null)
  })

  it('is not shown on a public page', () => {
    setup({ isPublic: true })

    expect(queryButton()).toBe(null)
  })

  it('is not shown on a document the user cannot change', () => {
    setup({ isReadOnly: true })

    expect(queryButton()).toBe(null)
  })

  it('is not shown without the assistant', () => {
    setup({ isAssistantEnabled: false })

    expect(queryButton()).toBe(null)
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import { AssistantButton } from '@/modules/views/Drive/Assistant/AssistantButton'
import { useAssistant } from '@/modules/views/Drive/Assistant/AssistantProvider'

jest.mock('cozy-flags')
jest.mock('@/modules/views/Drive/Assistant/AssistantProvider', () => ({
  useAssistant: jest.fn()
}))

const setup = ({ assistant = {}, isAssistantEnabled = true } = {}) => {
  const open = jest.fn()
  const close = jest.fn()
  flag.mockImplementation(
    name => name === 'cozy.assistant.enabled' && isAssistantEnabled
  )
  useAssistant.mockReturnValue({
    isAvailable: true,
    isOpen: false,
    open,
    close,
    ...assistant
  })

  render(
    <AppLike client={createMockClient({})}>
      <AssistantButton />
    </AppLike>
  )

  return { open, close }
}

const queryButton = () => screen.queryByRole('button', { name: 'Assistant' })

describe('AssistantButton', () => {
  it('opens the assistant', () => {
    const { open } = setup()

    fireEvent.click(queryButton())

    expect(open).toHaveBeenCalled()
    expect(queryButton().getAttribute('aria-pressed')).toBe('false')
  })

  it('closes the assistant when it is open', () => {
    const { open, close } = setup({ assistant: { isOpen: true } })

    fireEvent.click(queryButton())

    expect(close).toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(queryButton().getAttribute('aria-pressed')).toBe('true')
  })

  it('is not shown in a view without the assistant', () => {
    setup({ assistant: { isAvailable: false } })

    expect(queryButton()).toBe(null)
  })

  it('is not shown without the assistant flag', () => {
    setup({ isAssistantEnabled: false })

    expect(queryButton()).toBe(null)
  })
})

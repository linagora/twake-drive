import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import {
  AssistantProvider,
  useAssistant
} from '@/modules/views/Drive/Assistant/AssistantProvider'

const AssistantState = () => {
  const { isAvailable, isOpen, open, close } = useAssistant()

  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ isAvailable, isOpen })}
      </output>
      <button onClick={open}>open</button>
      <button onClick={close}>close</button>
    </>
  )
}

const getState = () => JSON.parse(screen.getByTestId('state').textContent)

describe('AssistantProvider', () => {
  it('is available, and opens and closes', () => {
    render(
      <AssistantProvider>
        <AssistantState />
      </AssistantProvider>
    )

    expect(getState()).toEqual({ isAvailable: true, isOpen: false })

    fireEvent.click(screen.getByText('open'))
    expect(getState().isOpen).toBe(true)

    fireEvent.click(screen.getByText('close'))
    expect(getState().isOpen).toBe(false)
  })

  it('is not available without the provider', () => {
    render(<AssistantState />)

    expect(getState()).toEqual({ isAvailable: false, isOpen: false })
  })
})

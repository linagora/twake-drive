import { render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { AssistantPanel } from '@/modules/views/Drive/Assistant/AssistantPanel'
import { useAssistant } from '@/modules/views/Drive/Assistant/AssistantProvider'

jest.mock('@/modules/views/Drive/Assistant/AssistantProvider', () => ({
  useAssistant: jest.fn()
}))

const mockIntentIframe = jest.fn()
jest.mock('cozy-ui-plus/dist/Intent/IntentIframe', () => ({
  __esModule: true,
  default: props => {
    mockIntentIframe(props)
    return <div data-testid="intent" />
  }
}))

const setup = (assistant = {}) => {
  const close = jest.fn()
  useAssistant.mockReturnValue({
    isAvailable: true,
    isOpen: true,
    close,
    ...assistant
  })

  render(
    <AppLike client={createMockClient({})}>
      <AssistantPanel />
    </AppLike>
  )

  return { close }
}

const getIntentProps = () => mockIntentIframe.mock.calls.at(-1)[0]

describe('AssistantPanel', () => {
  it('shows nothing while the assistant is closed', () => {
    setup({ isOpen: false })

    expect(screen.queryByTestId('assistant-panel')).toBe(null)
  })

  it('opens the assistant intent on the documents of the user', () => {
    setup()

    expect(screen.queryByTestId('intent')).toBeInTheDocument()
    expect(getIntentProps()).toMatchObject({
      action: 'OPEN',
      type: 'io.cozy.ai.chat.conversations',
      data: {
        documents: true,
        theme: { type: 'light' }
      }
    })
    expect(getIntentProps().data).not.toHaveProperty('content')
  })

  it('closes when the assistant cancels the intent, or when it ends', () => {
    const { close } = setup()

    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)

    getIntentProps().onCancel()
    expect(close).toHaveBeenCalledTimes(1)

    getIntentProps().onTerminate()
    expect(close).toHaveBeenCalledTimes(2)
  })
})

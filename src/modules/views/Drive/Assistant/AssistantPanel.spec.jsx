import { fireEvent, render, screen } from '@testing-library/react'
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
    return (
      <button
        data-testid="intent-capability"
        onClick={() =>
          props.onResult({
            capability: 'create_folder',
            params: { name: 'Factures 2026' }
          })
        }
      />
    )
  }
}))

const setup = (assistant = {}) => {
  const close = jest.fn()
  const applyResult = jest.fn()
  useAssistant.mockReturnValue({
    isAvailable: true,
    isOpen: true,
    close,
    applyResult,
    ...assistant
  })

  render(
    <AppLike client={createMockClient({})}>
      <AssistantPanel />
    </AppLike>
  )

  return { close, applyResult }
}

const getIntentProps = () => mockIntentIframe.mock.calls.at(-1)[0]

describe('AssistantPanel', () => {
  it('shows nothing while the assistant is closed', () => {
    setup({ isOpen: false })

    expect(screen.queryByTestId('assistant-panel')).toBe(null)
  })

  it('opens the assistant intent on the documents of the user, with the capabilities of the folder', () => {
    setup()

    expect(screen.queryByTestId('intent-capability')).toBeInTheDocument()
    expect(getIntentProps()).toMatchObject({
      action: 'OPEN',
      type: 'io.cozy.ai.chat.conversations',
      data: {
        documents: true,
        theme: { type: 'light' }
      }
    })
    expect(getIntentProps().data).not.toHaveProperty('content')

    const { capabilities } = getIntentProps().data
    expect(capabilities).toEqual([
      expect.objectContaining({
        name: 'create_folder',
        label: 'Create the folder',
        description: expect.stringContaining('create a folder'),
        parameters: expect.objectContaining({ required: ['name'] })
      }),
      expect.objectContaining({
        name: 'create_document',
        label: 'Create the document',
        description: expect.stringContaining('write a text document'),
        content: { max_tokens: 2048 }
      })
    ])
  })

  it('hands a capability call over, and stays open', () => {
    const { applyResult, close } = setup()

    fireEvent.click(screen.getByTestId('intent-capability'))

    expect(applyResult).toHaveBeenCalledWith({
      capability: 'create_folder',
      params: { name: 'Factures 2026' }
    })
    expect(close).not.toHaveBeenCalled()
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

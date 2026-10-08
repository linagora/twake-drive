import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { ScribePanel } from '@/modules/views/OnlyOffice/Scribe/ScribePanel'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn()
}))

const mockIntentIframe = jest.fn()
jest.mock('cozy-ui-plus/dist/Intent/IntentIframe', () => ({
  __esModule: true,
  default: props => {
    mockIntentIframe(props)
    return (
      <>
        <button
          data-testid="intent-iframe"
          onClick={() =>
            props.onResult({
              answerAction: 'insert',
              text: 'Bonjour',
              format: 'markdown'
            })
          }
        />
        <button
          data-testid="intent-capability"
          onClick={() =>
            props.onResult({
              capability: 'insert_slide',
              params: { title: 'Budget', bullets: ['Dépenses'] }
            })
          }
        />
      </>
    )
  }
}))

const setup = (scribe = {}) => {
  const close = jest.fn()
  const applyResult = jest.fn()
  useScribe.mockReturnValue({
    isOpen: true,
    content: 'Un **texte**',
    target: 'selection',
    documentType: 'word',
    close,
    applyResult,
    ...scribe
  })

  const { rerender } = render(
    <AppLike client={createMockClient({})}>
      <ScribePanel />
    </AppLike>
  )

  return { close, applyResult, rerender }
}

const getIntentProps = () => mockIntentIframe.mock.calls.at(-1)[0]

describe('ScribePanel', () => {
  it('shows nothing while the scribe is closed', () => {
    setup({ isOpen: false })

    expect(screen.queryByTestId('intent-iframe')).toBe(null)
  })

  it('opens the assistant intent on the selected text, to insert or replace', () => {
    setup()

    expect(screen.queryByTestId('intent-iframe')).toBeInTheDocument()
    expect(getIntentProps()).toMatchObject({
      action: 'OPEN',
      type: 'io.cozy.ai.chat.conversations',
      data: {
        content: 'Un **texte**',
        answerActions: [
          { name: 'insert', label: 'Insert' },
          { name: 'replace', label: 'Replace' }
        ],
        theme: { type: 'light' }
      }
    })
  })

  it('lets the assistant add a table to a text document, and offers it as a chip', () => {
    setup()

    const { capabilities, suggestions } = getIntentProps().data
    expect(capabilities).toEqual([
      {
        name: 'insert_table',
        description: expect.stringContaining('insert a new table'),
        examples: expect.any(Array),
        parameters: {
          type: 'object',
          properties: {
            caption: expect.objectContaining({ type: 'string' }),
            columns: expect.objectContaining({
              type: 'array',
              items: { type: 'string' }
            }),
            rows: expect.objectContaining({
              type: 'array',
              items: { type: 'string' }
            })
          },
          required: ['columns', 'rows']
        },
        instructions: expect.any(String),
        confirm: false
      }
    ])
    expect(suggestions).toEqual([
      { name: 'catalogue' },
      {
        name: 'table',
        capability: 'insert_table',
        label: 'Make a table',
        message: 'Present the text as a table'
      }
    ])
  })

  it('lets the assistant add a slide to a presentation, and offers it as a chip', () => {
    setup({ documentType: 'slide', target: 'slide' })

    const { capabilities, suggestions } = getIntentProps().data
    expect(capabilities).toEqual([
      {
        name: 'insert_slide',
        label: 'Insert the slide',
        description: expect.stringContaining('add a new slide'),
        examples: expect.any(Array),
        parameters: {
          type: 'object',
          properties: {
            title: expect.objectContaining({ type: 'string' }),
            bullets: expect.objectContaining({
              type: 'array',
              items: { type: 'string' }
            })
          },
          required: ['title', 'bullets']
        },
        instructions: expect.any(String),
        confirm: false
      }
    ])
    expect(suggestions).toEqual([
      { name: 'catalogue' },
      {
        name: 'new_slide',
        capability: 'insert_slide',
        label: 'New slide',
        message: 'Add a new slide after this one, about the text'
      }
    ])
  })

  it('leaves the assistant its own chips in an editor without a capability', () => {
    setup({ documentType: undefined })

    expect(getIntentProps().data).not.toHaveProperty('capabilities')
    expect(getIntentProps().data).not.toHaveProperty('suggestions')
  })

  it('gives the intent another text selected while it is open', () => {
    const { rerender } = setup()
    useScribe.mockReturnValue({
      ...useScribe(),
      content: 'Un autre texte'
    })
    rerender(
      <AppLike client={createMockClient({})}>
        <ScribePanel />
      </AppLike>
    )

    expect(getIntentProps().data.content).toBe('Un autre texte')
  })

  it('only lets an answer on the whole document be inserted', () => {
    setup({ target: 'document' })

    expect(getIntentProps().data.answerActions).toEqual([
      { name: 'insert', label: 'Insert' }
    ])
  })

  it('only lets an answer be inserted when the selection cannot be replaced', () => {
    setup({ canReplace: false })

    expect(getIntentProps().data.answerActions).toEqual([
      { name: 'insert', label: 'Insert' }
    ])
  })

  it('hands each answer over, and stays open', () => {
    const { applyResult, close } = setup()

    fireEvent.click(screen.getByTestId('intent-iframe'))

    expect(applyResult).toHaveBeenCalledWith({
      answerAction: 'insert',
      text: 'Bonjour',
      format: 'markdown'
    })
    expect(close).not.toHaveBeenCalled()
  })

  it('hands a capability call over, and stays open', () => {
    const { applyResult, close } = setup({ documentType: 'slide' })

    fireEvent.click(screen.getByTestId('intent-capability'))

    expect(applyResult).toHaveBeenCalledWith({
      capability: 'insert_slide',
      params: { title: 'Budget', bullets: ['Dépenses'] }
    })
    expect(close).not.toHaveBeenCalled()
  })

  it('closes with its cross, or when the intent ends', () => {
    const { close } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(close).toHaveBeenCalledTimes(1)

    getIntentProps().onCancel()
    expect(close).toHaveBeenCalledTimes(2)
  })
})

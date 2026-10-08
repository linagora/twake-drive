import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import logger from '@/lib/logger'
import {
  ScribeProvider,
  useScribe
} from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))

const SERVER_URL = 'https://onlyoffice.example.org/'
const SERVER_ORIGIN = 'https://onlyoffice.example.org'

const SLIDE = {
  capability: 'insert_slide',
  params: {
    title: 'Budget',
    bullets: ['Dépenses', '- Recettes', '']
  }
}
const TABLE = {
  capability: 'insert_table',
  params: {
    caption: 'Budget des lots',
    columns: ['Lot', 'Budget'],
    rows: ['Atlas | 42 000 €', 'Borée | 12 000 €', '']
  }
}

const ScribeState = ({ results = [] }) => {
  const {
    isAvailable,
    isOpen,
    content,
    target,
    canReplace,
    open,
    close,
    applyResult
  } = useScribe()

  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ isAvailable, isOpen, content, target, canReplace })}
      </output>
      <button onClick={open}>open</button>
      <button onClick={close}>close</button>
      <button
        onClick={() =>
          applyResult({
            answerAction: 'replace',
            text: 'Bonjour',
            format: 'markdown'
          })
        }
      >
        apply
      </button>
      {results.map((result, index) => (
        <button key={index} onClick={() => applyResult(result)}>
          {`result ${index}`}
        </button>
      ))}
    </>
  )
}

const setup = ({ documentType = 'word', results } = {}) => {
  const plugin = { postMessage: jest.fn() }
  const receive = (data, { origin = SERVER_ORIGIN, source = plugin } = {}) => {
    act(() => {
      const event = new MessageEvent('message', { data, origin })
      // jsdom only takes a real window as the source of a MessageEvent
      Object.defineProperty(event, 'source', { value: source })
      window.dispatchEvent(event)
    })
  }

  render(
    <ScribeProvider serverUrl={SERVER_URL} documentType={documentType}>
      <ScribeState results={results} />
    </ScribeProvider>
  )

  const getState = () => JSON.parse(screen.getByTestId('state').textContent)

  return { plugin, receive, getState }
}

describe('ScribeProvider', () => {
  it('has no scribe until the plugin of the Document Server is ready', () => {
    const { receive, getState } = setup()

    expect(getState()).toEqual({ isAvailable: false, isOpen: false })

    receive({ type: 'twake-scribe:ready' })

    expect(getState()).toEqual({ isAvailable: true, isOpen: false })
  })

  it('ignores the messages that do not come from the Document Server', () => {
    const { receive, getState } = setup()

    receive({ type: 'twake-scribe:ready' }, { origin: 'https://example.org' })
    receive('a text', { origin: SERVER_ORIGIN })

    expect(getState().isAvailable).toBe(false)
  })

  it('asks the plugin for the text, and opens when it comes', () => {
    const { plugin, receive, getState } = setup()
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('open'))

    expect(plugin.postMessage).toHaveBeenCalledWith(
      { type: 'twake-scribe:getContent' },
      SERVER_ORIGIN
    )
    expect(getState().isOpen).toBe(false)

    receive({
      type: 'twake-scribe:content',
      content: 'Un **texte**',
      target: 'selection',
      canReplace: true
    })

    expect(getState()).toEqual({
      isAvailable: true,
      isOpen: true,
      content: 'Un **texte**',
      target: 'selection',
      canReplace: true
    })
  })

  it('works on another text selected while it is open, and not when closed', () => {
    const { receive, getState } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive({
      type: 'twake-scribe:selection',
      content: 'Avant',
      target: 'selection'
    })
    expect(getState().isOpen).toBe(false)

    receive({ type: 'twake-scribe:content', content: '', target: 'document' })
    receive({
      type: 'twake-scribe:selection',
      content: 'Autre',
      target: 'selection',
      canReplace: false
    })

    expect(getState()).toEqual({
      isAvailable: true,
      isOpen: true,
      content: 'Autre',
      target: 'selection',
      canReplace: false
    })
  })

  it('closes, and tells the plugin to stop reading the selection', () => {
    const { plugin, receive, getState } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive({ type: 'twake-scribe:content', content: '', target: 'document' })
    expect(getState().isOpen).toBe(true)

    fireEvent.click(screen.getByText('close'))

    expect(getState()).toEqual({ isAvailable: true, isOpen: false })
    expect(plugin.postMessage).toHaveBeenCalledWith(
      { type: 'twake-scribe:close' },
      SERVER_ORIGIN
    )
  })

  it('hands an answer of the assistant to the plugin as it is', () => {
    const { plugin, receive } = setup()
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('apply'))

    expect(plugin.postMessage).toHaveBeenCalledWith(
      {
        type: 'twake-scribe:applyAnswer',
        answerAction: 'replace',
        text: 'Bonjour',
        format: 'markdown'
      },
      SERVER_ORIGIN
    )
  })

  it('asks the plugin to add the slide the assistant has made, in a presentation', () => {
    const { plugin, receive } = setup({
      documentType: 'slide',
      results: [SLIDE]
    })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('result 0'))

    expect(plugin.postMessage).toHaveBeenCalledWith(
      {
        type: 'twake-scribe:insertSlide',
        title: 'Budget',
        bullets: ['Dépenses', 'Recettes']
      },
      SERVER_ORIGIN
    )
  })

  it('ignores an unknown capability, wrong parameters, and a slide outside of a presentation', () => {
    const results = [
      { capability: 'delete_slide', params: {} },
      { capability: 'insert_slide', params: { title: 'Budget' } },
      { capability: 'insert_slide', params: { title: '', bullets: [] } },
      { capability: 'insert_slide', params: null }
    ]
    const { plugin, receive } = setup({ documentType: 'slide', results })
    receive({ type: 'twake-scribe:ready' })

    results.forEach((_, index) =>
      fireEvent.click(screen.getByText(`result ${index}`))
    )

    expect(plugin.postMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(results.length)
  })

  it('adds no slide to a text document', () => {
    const { plugin, receive } = setup({ results: [SLIDE] })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('result 0'))

    expect(plugin.postMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })

  it('writes the table the assistant has made in a text document, as a Markdown answer', () => {
    const { plugin, receive } = setup({ results: [TABLE] })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('result 0'))

    expect(plugin.postMessage).toHaveBeenCalledWith(
      {
        type: 'twake-scribe:applyAnswer',
        answerAction: 'insert',
        text: 'Budget des lots\n\n| Lot | Budget |\n| --- | --- |\n| Atlas | 42 000 € |\n| Borée | 12 000 € |',
        format: 'markdown'
      },
      SERVER_ORIGIN
    )
  })

  it('ignores a table with wrong parameters, or outside of a text document', () => {
    const results = [
      { capability: 'insert_table', params: { columns: ['Lot'] } },
      { capability: 'insert_table', params: { columns: [], rows: ['Atlas'] } },
      { capability: 'insert_table', params: null }
    ]
    const { plugin, receive } = setup({ results })
    receive({ type: 'twake-scribe:ready' })

    results.forEach((_, index) =>
      fireEvent.click(screen.getByText(`result ${index}`))
    )

    expect(plugin.postMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(results.length)
  })

  it('adds no table to a presentation', () => {
    const { plugin, receive } = setup({
      documentType: 'slide',
      results: [TABLE]
    })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('result 0'))

    expect(plugin.postMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import flag from 'cozy-flags'

import logger from '@/lib/logger'
import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  ScribeProvider,
  useScribe
} from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('cozy-flags')
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
    geometry,
    source,
    open,
    close,
    applyResult
  } = useScribe()

  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ isAvailable, isOpen, content, target, canReplace })}
      </output>
      <output data-testid="geometry">{JSON.stringify(geometry)}</output>
      <output data-testid="source">{JSON.stringify(source)}</output>
      <button onClick={() => open({ source: 'selection' })}>open</button>
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

const setup = ({
  documentType = 'word',
  results,
  isPublic = false,
  isReadOnly = false,
  isAssistantEnabled = true
} = {}) => {
  flag.mockImplementation(
    name => name === 'cozy.assistant.enabled' && isAssistantEnabled
  )
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
    <OnlyOfficeContext.Provider value={{ isPublic, isReadOnly }}>
      <ScribeProvider serverUrl={SERVER_URL} documentType={documentType}>
        <ScribeState results={results} />
      </ScribeProvider>
    </OnlyOfficeContext.Provider>
  )

  const getState = () => JSON.parse(screen.getByTestId('state').textContent)
  const getGeometry = () =>
    JSON.parse(screen.getByTestId('geometry').textContent)
  const getSource = () => JSON.parse(screen.getByTestId('source').textContent)
  // Every ready plugin is told to show its entries in the editor's toolbar
  const getSent = () =>
    plugin.postMessage.mock.calls.filter(
      ([message]) => message.type !== 'twake-scribe:showToolbar'
    )

  return { plugin, receive, getState, getGeometry, getSource, getSent }
}

const SELECTION = {
  rect: {
    left: 358,
    top: 269,
    width: 118,
    height: 15,
    corners: [
      [358, 269],
      [358, 284],
      [476, 269],
      [476, 284]
    ]
  },
  hasText: true
}
const VIEWER = { left: 59, top: 174, width: 1167, height: 465 }

const addEditorFrame = box => {
  const frame = document.createElement('iframe')
  frame.name = 'frameEditor'
  frame.getBoundingClientRect = () => box
  document.body.appendChild(frame)
  return frame
}

describe('ScribeProvider', () => {
  afterEach(() => {
    ;[...document.getElementsByName('frameEditor')].forEach(frame =>
      frame.remove()
    )
    localStorage.clear()
    jest.useRealTimers()
  })

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

  it('records where the scribe was opened from', () => {
    const { receive, getSource } = setup()
    receive({ type: 'twake-scribe:ready' })
    expect(getSource()).toBe(null)

    fireEvent.click(screen.getByText('open'))

    expect(getSource()).toBe('selection')
  })

  it('tells the plugin once to show its entries in the toolbar of the editor', () => {
    const { plugin, receive } = setup()

    receive({ type: 'twake-scribe:ready' })
    receive({ type: 'twake-scribe:ready' })

    expect(plugin.postMessage.mock.calls).toEqual([
      [{ type: 'twake-scribe:showToolbar' }, SERVER_ORIGIN]
    ])
  })

  it('ignores the messages of another frame of the Document Server', () => {
    addEditorFrame({ left: 0, top: 49, width: 1280, height: 671 })
    const other = { postMessage: jest.fn() }
    const { plugin, receive, getState, getGeometry } = setup()
    receive({ type: 'twake-scribe:ready' })
    plugin.postMessage.mockClear()

    receive(
      { type: 'twake-scribe:content', content: 'Autre', target: 'selection' },
      { source: other }
    )
    receive(
      {
        type: 'twake-scribe:geometry',
        selection: SELECTION,
        viewer: VIEWER,
        page: null
      },
      { source: other }
    )
    receive(
      { type: 'twake-scribe:open', source: 'toolbar-panel' },
      { source: other }
    )

    expect(getState().isOpen).toBe(false)
    expect(getGeometry()).toBe(null)
    expect(plugin.postMessage).not.toHaveBeenCalled()
  })

  it('opens the panel from the toolbar of the editor', () => {
    const { receive, getSource, getSent } = setup()
    receive({ type: 'twake-scribe:ready' })

    receive({ type: 'twake-scribe:open', source: 'toolbar-inline' })

    expect(getSent()).toEqual([
      [{ type: 'twake-scribe:getContent' }, SERVER_ORIGIN]
    ])
    expect(getSource()).toBe('editor-toolbar')
  })

  it('toggles the panel from its panel entry', () => {
    const { plugin, receive, getState, getSource, getSent } = setup()
    receive({ type: 'twake-scribe:ready' })

    receive({ type: 'twake-scribe:open', source: 'toolbar-panel' })

    expect(getSent()).toEqual([
      [{ type: 'twake-scribe:getContent' }, SERVER_ORIGIN]
    ])
    expect(getSource()).toBe('editor-toolbar')

    receive({ type: 'twake-scribe:content', content: '', target: 'document' })
    expect(getState().isOpen).toBe(true)

    receive({ type: 'twake-scribe:open', source: 'toolbar-panel' })

    expect(getState().isOpen).toBe(false)
    expect(plugin.postMessage).toHaveBeenLastCalledWith(
      { type: 'twake-scribe:close' },
      SERVER_ORIGIN
    )
  })

  it('ignores another entry, or another origin, asking to open', () => {
    const { receive, getSent } = setup()
    receive({ type: 'twake-scribe:ready' })

    receive({ type: 'twake-scribe:open', source: 'toolbar' })
    receive({ type: 'twake-scribe:open' })
    receive(
      { type: 'twake-scribe:open', source: 'toolbar-panel' },
      { origin: 'https://example.org' }
    )

    expect(getSent()).toEqual([])
  })

  it.each([
    ['on a public link', { isPublic: true }],
    ['in a read-only document', { isReadOnly: true }],
    ['without the assistant', { isAssistantEnabled: false }]
  ])(
    'shows no entry in the toolbar of the editor, and ignores them, %s',
    (_, options) => {
      const { plugin, receive, getState } = setup(options)
      receive({ type: 'twake-scribe:ready' })

      receive({ type: 'twake-scribe:open', source: 'toolbar-inline' })
      receive({ type: 'twake-scribe:open', source: 'toolbar-panel' })

      expect(plugin.postMessage).not.toHaveBeenCalled()
      expect(getState().isOpen).toBe(false)
    }
  )

  it('keeps the geometry the plugin sends, with the box of the editor frame', () => {
    const frame = addEditorFrame({
      left: 0,
      top: 49,
      width: 1280,
      height: 671
    })
    const { receive, getGeometry } = setup()
    receive({ type: 'twake-scribe:ready' })
    expect(getGeometry()).toBe(null)

    receive({
      type: 'twake-scribe:geometry',
      selection: SELECTION,
      viewer: VIEWER,
      page: null
    })

    expect(getGeometry()).toEqual({
      selection: SELECTION,
      viewer: VIEWER,
      frame: { left: 0, top: 49, width: 1280, height: 671 }
    })

    frame.getBoundingClientRect = () => ({
      left: 0,
      top: 80,
      width: 900,
      height: 640
    })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(getGeometry().frame).toEqual({
      left: 0,
      top: 80,
      width: 900,
      height: 640
    })

    receive({
      type: 'twake-scribe:geometry',
      selection: null,
      viewer: VIEWER,
      page: null
    })

    expect(getGeometry()).toEqual({
      selection: null,
      viewer: VIEWER,
      frame: { left: 0, top: 80, width: 900, height: 640 }
    })
  })

  it('has no geometry without the editor frame', () => {
    const { receive, getGeometry } = setup()
    receive({ type: 'twake-scribe:ready' })

    receive({
      type: 'twake-scribe:geometry',
      selection: SELECTION,
      viewer: VIEWER,
      page: null
    })

    expect(getGeometry()).toBe(null)
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

  it('asks the plugin for the text at start when the panel was open', () => {
    localStorage.setItem('scribe-panel-open', 'true')
    const { receive, getSource, getSent } = setup()
    expect(getSent()).toEqual([])

    receive({ type: 'twake-scribe:ready' })
    receive({ type: 'twake-scribe:ready' })

    expect(getSent()).toEqual([
      [{ type: 'twake-scribe:getContent' }, SERVER_ORIGIN]
    ])
    expect(getSource()).toBe('restored')
  })

  it('remembers whether the panel was open', () => {
    const { receive } = setup()
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('open'))
    expect(localStorage.getItem('scribe-panel-open')).toBe('true')

    receive({ type: 'twake-scribe:content', content: '', target: 'document' })
    fireEvent.click(screen.getByText('close'))
    expect(localStorage.getItem('scribe-panel-open')).toBe('false')
  })

  it('stays closed at start when the panel was closed', () => {
    localStorage.setItem('scribe-panel-open', 'false')
    const { receive, getSent } = setup()

    receive({ type: 'twake-scribe:ready' })

    expect(getSent()).toEqual([])
  })

  it('stays closed at start when the panel is closed before the plugin is ready', () => {
    localStorage.setItem('scribe-panel-open', 'true')
    const { receive, getSent } = setup()

    fireEvent.click(screen.getByText('close'))
    receive({ type: 'twake-scribe:ready' })

    expect(getSent()).toEqual([])
    expect(localStorage.getItem('scribe-panel-open')).toBe('false')
  })

  it.each([
    ['on a public link', { isPublic: true }],
    ['in a read-only document', { isReadOnly: true }],
    ['without the assistant', { isAssistantEnabled: false }]
  ])('stays closed at start %s', (_, options) => {
    localStorage.setItem('scribe-panel-open', 'true')
    const { plugin, receive } = setup(options)

    receive({ type: 'twake-scribe:ready' })

    expect(plugin.postMessage).not.toHaveBeenCalled()
  })

  it('gives the focus back to the document 100 ms after closing', () => {
    jest.useFakeTimers()
    const frame = addEditorFrame({
      left: 0,
      top: 49,
      width: 1280,
      height: 671
    })
    frame.focus = jest.fn()
    const { receive } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive({ type: 'twake-scribe:content', content: '', target: 'document' })

    fireEvent.click(screen.getByText('close'))
    act(() => {
      jest.advanceTimersByTime(99)
    })
    expect(frame.focus).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(frame.focus).toHaveBeenCalledTimes(1)
  })

  it('closes without the editor frame', () => {
    jest.useFakeTimers()
    const { receive, getState } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive({ type: 'twake-scribe:content', content: '', target: 'document' })

    fireEvent.click(screen.getByText('close'))

    expect(() => jest.advanceTimersByTime(100)).not.toThrow()
    expect(getState().isOpen).toBe(false)
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
    const { receive, getSent } = setup({ documentType: 'slide', results })
    receive({ type: 'twake-scribe:ready' })

    results.forEach((_, index) =>
      fireEvent.click(screen.getByText(`result ${index}`))
    )

    expect(getSent()).toEqual([])
    expect(logger.warn).toHaveBeenCalledTimes(results.length)
  })

  it('adds no slide to a text document', () => {
    const { receive, getSent } = setup({ results: [SLIDE] })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('result 0'))

    expect(getSent()).toEqual([])
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
    const { receive, getSent } = setup({ results })
    receive({ type: 'twake-scribe:ready' })

    results.forEach((_, index) =>
      fireEvent.click(screen.getByText(`result ${index}`))
    )

    expect(getSent()).toEqual([])
    expect(logger.warn).toHaveBeenCalledTimes(results.length)
  })

  it('adds no table to a presentation', () => {
    const { receive, getSent } = setup({
      documentType: 'slide',
      results: [TABLE]
    })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('result 0'))

    expect(getSent()).toEqual([])
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})

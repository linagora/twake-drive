import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import flag from 'cozy-flags'

import logger from '@/lib/logger'
import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import {
  ScribeProvider,
  useScribe,
  useScribeGeometry
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
    isPopoverOpen,
    content,
    target,
    canReplace,
    source,
    popoverSource,
    draft,
    conversation,
    open,
    close,
    openPopover,
    closePopover,
    applyResult
  } = useScribe()
  const geometry = useScribeGeometry()

  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ isAvailable, isOpen, content, target, canReplace })}
      </output>
      <output data-testid="popover">
        {JSON.stringify({ isPopoverOpen, popoverSource })}
      </output>
      <output data-testid="hand-over">
        {JSON.stringify({ draft, conversation })}
      </output>
      <output data-testid="geometry">{JSON.stringify(geometry)}</output>
      <output data-testid="source">{JSON.stringify(source)}</output>
      <button onClick={() => open({ source: 'selection' })}>open</button>
      <button onClick={close}>close</button>
      <button onClick={() => openPopover({ source: 'selection' })}>
        open popover
      </button>
      <button onClick={closePopover}>close popover</button>
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
  isAssistantEnabled = true,
  extra = null
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
        {extra}
      </ScribeProvider>
    </OnlyOfficeContext.Provider>
  )

  const getState = () => JSON.parse(screen.getByTestId('state').textContent)
  const getPopover = () => JSON.parse(screen.getByTestId('popover').textContent)
  const getHandOver = () =>
    JSON.parse(screen.getByTestId('hand-over').textContent)
  const getGeometry = () =>
    JSON.parse(screen.getByTestId('geometry').textContent)
  const getSource = () => JSON.parse(screen.getByTestId('source').textContent)
  // Every ready plugin is told to show its entries in the editor's toolbar
  const getSent = () =>
    plugin.postMessage.mock.calls.filter(
      ([message]) => message.type !== 'twake-scribe:showToolbar'
    )

  return {
    plugin,
    receive,
    getState,
    getPopover,
    getHandOver,
    getGeometry,
    getSource,
    getSent
  }
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
const FRAME = { left: 0, top: 49, width: 1280, height: 671 }
const SELECTION_GEOMETRY = {
  type: 'twake-scribe:geometry',
  selection: SELECTION,
  viewer: VIEWER,
  page: null
}
const SELECTED_TEXT = {
  content: 'Un **texte**',
  target: 'selection',
  canReplace: true
}

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

  it('opens the popover on the selection from the toolbar of the editor', () => {
    addEditorFrame(FRAME)
    const { receive, getState, getPopover, getSent } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)

    receive({ type: 'twake-scribe:open', source: 'toolbar-inline' })

    expect(getSent()).toEqual([
      [{ type: 'twake-scribe:getContent' }, SERVER_ORIGIN]
    ])
    receive({
      type: 'twake-scribe:content',
      content: 'Un texte',
      target: 'selection'
    })
    expect(getPopover()).toEqual({
      isPopoverOpen: true,
      popoverSource: 'editor-toolbar'
    })
    expect(getState().isOpen).toBe(false)
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

  it('opens the popover, not the panel, when the content was asked for it', () => {
    addEditorFrame(FRAME)
    const { receive, getState, getPopover, getSent } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)

    fireEvent.click(screen.getByText('open popover'))

    expect(getSent()).toEqual([
      [{ type: 'twake-scribe:getContent' }, SERVER_ORIGIN]
    ])
    expect(getPopover().isPopoverOpen).toBe(false)

    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })

    expect(getPopover()).toEqual({
      isPopoverOpen: true,
      popoverSource: 'selection'
    })
    expect(getState()).toEqual({
      isAvailable: true,
      isOpen: false,
      ...SELECTED_TEXT
    })
    // Only the panel opens again on the next load
    expect(localStorage.getItem('scribe-panel-open')).toBe(null)
  })

  it('opens the panel instead of the popover without the place of the selection', () => {
    const { receive, getState, getPopover, getSource } = setup({
      documentType: 'slide'
    })
    receive({ type: 'twake-scribe:ready' })

    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', content: 'Diapo', target: 'slide' })

    expect(getPopover().isPopoverOpen).toBe(false)
    expect(getState().isOpen).toBe(true)
    expect(getSource()).toBe('selection')
  })

  it('hands a draft over to the panel on a panel request', () => {
    addEditorFrame(FRAME)
    const {
      plugin,
      receive,
      getState,
      getPopover,
      getHandOver,
      getSource,
      getSent
    } = setup({
      results: [{ request: 'panel', draft: 'Plus court', conversation: 'c1' }]
    })
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    plugin.postMessage.mockClear()

    fireEvent.click(screen.getByText('result 0'))

    expect(getPopover().isPopoverOpen).toBe(false)
    expect(getState()).toEqual({
      isAvailable: true,
      isOpen: true,
      ...SELECTED_TEXT
    })
    expect(getHandOver()).toEqual({ draft: 'Plus court', conversation: 'c1' })
    expect(getSource()).toBe('popover')
    expect(localStorage.getItem('scribe-panel-open')).toBe('true')
    // The text of the popover is still the selection: the plugin is neither
    // asked for it again nor told to stop reading it
    expect(getSent()).toEqual([])

    fireEvent.click(screen.getByText('close'))

    expect(getHandOver()).toEqual({ draft: null, conversation: null })
  })

  it('tells the plugin to close only when both are closed', () => {
    addEditorFrame(FRAME)
    const { plugin, receive, getState, getPopover } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    const isCloseSent = () =>
      plugin.postMessage.mock.calls.some(
        ([message]) => message.type === 'twake-scribe:close'
      )

    fireEvent.click(screen.getByText('open'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    expect(getState().isOpen).toBe(true)
    expect(getPopover().isPopoverOpen).toBe(true)

    fireEvent.click(screen.getByText('close popover'))
    expect(isCloseSent()).toBe(false)
    expect(getState()).toEqual({
      isAvailable: true,
      isOpen: true,
      ...SELECTED_TEXT
    })

    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    fireEvent.click(screen.getByText('close'))
    expect(isCloseSent()).toBe(false)
    expect(getPopover().isPopoverOpen).toBe(true)

    fireEvent.click(screen.getByText('close popover'))
    expect(isCloseSent()).toBe(true)
    expect(getState()).toEqual({ isAvailable: true, isOpen: false })
  })

  it('keeps the plugin reading while the text for the panel is awaited', () => {
    addEditorFrame(FRAME)
    const { plugin, receive, getState, getPopover } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })

    // The AI button is clicked away from the popover
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('close popover'))

    expect(plugin.postMessage).not.toHaveBeenCalledWith(
      { type: 'twake-scribe:close' },
      SERVER_ORIGIN
    )
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    expect(getState().isOpen).toBe(true)
    expect(getPopover().isPopoverOpen).toBe(false)
  })

  it('stops the plugin reading when the text awaited does not come in 3 s', () => {
    jest.useFakeTimers()
    addEditorFrame(FRAME)
    const { plugin, receive, getState } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    const isCloseSent = () =>
      plugin.postMessage.mock.calls.some(
        ([message]) => message.type === 'twake-scribe:close'
      )

    // The editor saves: the plugin does not answer
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('close popover'))
    act(() => {
      jest.advanceTimersByTime(2999)
    })
    expect(isCloseSent()).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(isCloseSent()).toBe(true)
    expect(getState()).toEqual({ isAvailable: true, isOpen: false })
  })

  it('opens only the surface asked last once the text awaited is given up on', () => {
    jest.useFakeTimers()
    addEditorFrame(FRAME)
    const { receive, getState, getPopover } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    fireEvent.click(screen.getByText('open'))
    fireEvent.click(screen.getByText('close popover'))

    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(getPopover().isPopoverOpen).toBe(true)
    expect(getState().isOpen).toBe(false)
  })

  it('leaves the popover as it is when asked to open it again', () => {
    addEditorFrame(FRAME)
    const { plugin, receive, getPopover, getSent } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    plugin.postMessage.mockClear()

    receive({ type: 'twake-scribe:open', source: 'toolbar-inline' })

    expect(getSent()).toEqual([])
    expect(getPopover()).toEqual({
      isPopoverOpen: true,
      popoverSource: 'selection'
    })
  })

  it('closes the popover when another text is selected', () => {
    addEditorFrame(FRAME)
    const { plugin, receive, getState, getPopover } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    fireEvent.click(screen.getByText('open popover'))
    receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })

    receive({ type: 'twake-scribe:selection', ...SELECTED_TEXT })
    expect(getPopover().isPopoverOpen).toBe(true)

    receive({
      type: 'twake-scribe:selection',
      content: 'Autre',
      target: 'selection'
    })

    expect(getPopover().isPopoverOpen).toBe(false)
    expect(getState()).toEqual({ isAvailable: true, isOpen: false })
    expect(plugin.postMessage).toHaveBeenLastCalledWith(
      { type: 'twake-scribe:close' },
      SERVER_ORIGIN
    )
  })

  it('gives the focus back to the document after the popover, unless it went elsewhere', () => {
    jest.useFakeTimers()
    const frame = addEditorFrame(FRAME)
    frame.focus = jest.fn()
    const { receive } = setup()
    receive({ type: 'twake-scribe:ready' })
    receive(SELECTION_GEOMETRY)
    const openPopover = () => {
      fireEvent.click(screen.getByText('open popover'))
      receive({ type: 'twake-scribe:content', ...SELECTED_TEXT })
    }

    openPopover()
    fireEvent.click(screen.getByText('close popover'))
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(frame.focus).toHaveBeenCalledTimes(1)

    openPopover()
    fireEvent.click(screen.getByText('close popover'))
    screen.getByText('open').focus()
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(frame.focus).toHaveBeenCalledTimes(1)
  })

  it('does not render the scribe again for a geometry', () => {
    addEditorFrame(FRAME)
    const renders = jest.fn()
    const ScribeConsumer = () => {
      useScribe()
      renders()
      return null
    }
    const { receive, getGeometry } = setup({ extra: <ScribeConsumer /> })
    receive({ type: 'twake-scribe:ready' })
    renders.mockClear()

    receive(SELECTION_GEOMETRY)
    receive({ ...SELECTION_GEOMETRY, selection: null })

    expect(getGeometry().selection).toBe(null)
    expect(renders).not.toHaveBeenCalled()
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

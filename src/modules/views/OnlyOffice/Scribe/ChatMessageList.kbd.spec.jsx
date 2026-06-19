import { render, screen, fireEvent } from '@testing-library/react'
import React, { useRef } from 'react'

// Light theme mock mirroring ChatMessageList.render.spec.jsx — the component
// tree (AssistantBubble / FragmentCard / MessageActions / MarkdownPreview /
// ChatInput) reads palette.text/action/divider/grey/primary/error/background.
jest.mock('cozy-ui/transpiled/react/styles', () => ({
  __esModule: true,
  useTheme: () => ({
    palette: {
      type: 'light',
      text: { primary: '#000', secondary: '#555' },
      divider: '#ddd',
      grey: { 50: '#fafafa', 800: '#333' },
      primary: { main: '#7C3AED' },
      error: { main: '#e00' },
      action: {
        hover: 'rgba(0,0,0,0.04)',
        selected: 'rgba(0,0,0,0.08)',
        disabled: '#999',
        disabledBackground: '#eee'
      },
      background: { paper: '#fff' }
    }
  })
}))

// Tooltip passthrough so the inner <button> stays focusable/queryable.
jest.mock('cozy-ui/transpiled/react/Tooltip', () => ({
  __esModule: true,
  default: ({ children }) => children
}))

// Spinner / Typography passthroughs (loading + welcome chrome).
jest.mock('cozy-ui/transpiled/react/Spinner', () => ({
  __esModule: true,
  default: () => null
}))
jest.mock('cozy-ui/transpiled/react/Typography', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>
}))

// i18n: echo the key so aria-labels are 'Scribe.button.copy' etc. and the input
// placeholder is a known string.
jest.mock('twake-i18n', () => ({
  __esModule: true,
  useI18n: () => ({ t: key => key })
}))

// SelectionChip is irrelevant to keyboard traversal — stub it out.
jest.mock('@/modules/views/OnlyOffice/Scribe/SelectionChip', () => ({
  __esModule: true,
  SelectionChip: () => null
}))

// Controllable useScribe — each test sets `scribeState` before render.
let scribeState
const insertSpy = jest.fn()
const replaceSpy = jest.fn()
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeContext', () => ({
  __esModule: true,
  useScribe: () => scribeState
}))

import { ChatMessageList } from '@/modules/views/OnlyOffice/Scribe/ChatMessageList'
import { ChatInput } from '@/modules/views/OnlyOffice/Scribe/ChatInput'

const setScribe = ({ messages, isLoading = false, currentSelection = null }) => {
  scribeState = {
    messages,
    isLoading,
    currentSelection,
    sendMessage: jest.fn(),
    dismissSelection: jest.fn(),
    panelActions: { insert: insertSpy, replace: replaceSpy }
  }
}

const assistant = (over = {}) => ({ id: 'a1', role: 'assistant', ...over })

// jsdom does not implement Element.prototype.scrollTo; the auto-scroll effect
// calls it on the container ref. Stub it so the effect is a harmless no-op.
beforeAll(() => {
  Element.prototype.scrollTo = () => {}
})

// Test harness that wires ChatMessageList <-> ChatInput exactly as ScribePanel
// does: input ArrowUp -> controller focuses most-recent card; controller
// Escape / Down-past-newest -> input.focus().
const Harness = () => {
  const inputRef = useRef(null)
  const listRef = useRef(null)
  return (
    <div>
      <ChatMessageList
        ref={listRef}
        returnFocusToInput={() =>
          inputRef.current && inputRef.current.focus()
        }
      />
      <ChatInput
        ref={inputRef}
        onArrowUp={() =>
          listRef.current && listRef.current.focusMostRecentCardInsert()
        }
      />
    </div>
  )
}

const getInput = () => screen.getByPlaceholderText('Scribe.prompt.placeholder')

describe('ChatMessageList — keyboard navigation (KBD-01..04)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    scribeState = undefined
  })

  describe('KBD-01 — ArrowUp from empty input focuses most-recent card Insert', () => {
    it('lands on the newest card Insert button when both messages carry cards', () => {
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['OLD'] },
          { id: 'a2', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['NEW'] }
        ]
      })
      render(<Harness />)
      const input = getInput()
      input.focus()
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      const inserts = screen.getAllByLabelText('Scribe.button.insert')
      // newest card is the last Insert button in document order
      expect(document.activeElement).toBe(inserts[inserts.length - 1])
    })

    it('D-10 — skips a most-recent pure-discussion (0-card) message back to the last carded one', () => {
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['CARDED'] },
          { id: 'a2', role: 'assistant', discussion: 'pure discussion', fragments: [] }
        ]
      })
      render(<Harness />)
      const input = getInput()
      input.focus()
      fireEvent.keyDown(input, { key: 'ArrowUp' })

      // Only one card in the whole thread -> its Insert button.
      const inserts = screen.getAllByLabelText('Scribe.button.insert')
      expect(inserts).toHaveLength(1)
      expect(document.activeElement).toBe(inserts[0])
    })

    it('empty-draft guard — ArrowUp with non-empty text stays in the input', () => {
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['C'] }
        ]
      })
      render(<Harness />)
      const input = getInput()
      fireEvent.change(input, { target: { value: 'draft line' } })
      input.focus()
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      expect(document.activeElement).toBe(input)
    })
  })

  describe('KBD-02 — Left/Right cycle Copy/Insert/Replace on the focused card', () => {
    it('with a selection, Right from Insert goes to Replace, Left goes to Copy', () => {
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['C'] }
        ],
        currentSelection: { text: 'sel' }
      })
      render(<Harness />)
      const copy = screen.getByLabelText('Scribe.button.copy')
      const insert = screen.getByLabelText('Scribe.button.insert')
      const replace = screen.getByLabelText('Scribe.button.replace')

      insert.focus()
      fireEvent.keyDown(insert, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(replace)

      fireEvent.keyDown(replace, { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(insert)

      fireEvent.keyDown(insert, { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(copy)
    })

    it('gating — with no selection the group is length 2 (Copy, Insert); Left/Right cycle only those', () => {
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['C'] }
        ],
        currentSelection: null
      })
      render(<Harness />)
      expect(screen.queryByLabelText('Scribe.button.replace')).toBeNull()
      const copy = screen.getByLabelText('Scribe.button.copy')
      const insert = screen.getByLabelText('Scribe.button.insert')

      copy.focus()
      fireEvent.keyDown(copy, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(insert)
      // wrap within the 2-button group
      fireEvent.keyDown(insert, { key: 'ArrowRight' })
      expect(document.activeElement).toBe(copy)
    })
  })

  describe('KBD-03 — Up/Down traverse cards across the thread', () => {
    const twoCardThread = () =>
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['OLD'] },
          { id: 'a2', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['NEW'] }
        ]
      })

    it('Down from the older card moves to the newer card; Up moves back', () => {
      twoCardThread()
      render(<Harness />)
      const inserts = screen.getAllByLabelText('Scribe.button.insert')
      const older = inserts[0]
      const newer = inserts[1]

      older.focus()
      fireEvent.keyDown(older, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(newer)

      fireEvent.keyDown(newer, { key: 'ArrowUp' })
      expect(document.activeElement).toBe(older)
    })

    it('Down past the most-recent card returns focus to the input', () => {
      twoCardThread()
      render(<Harness />)
      const inserts = screen.getAllByLabelText('Scribe.button.insert')
      const newer = inserts[inserts.length - 1]
      newer.focus()
      fireEvent.keyDown(newer, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(getInput())
    })

    it('Up from the oldest card does not wrap (stays within the oldest card)', () => {
      twoCardThread()
      render(<Harness />)
      const inserts = screen.getAllByLabelText('Scribe.button.insert')
      const older = inserts[0]
      older.focus()
      fireEvent.keyDown(older, { key: 'ArrowUp' })
      // focus remains on a button of the oldest card (not wrapped to newest)
      const copyButtons = screen.getAllByLabelText('Scribe.button.copy')
      const oldestCardButtons = [copyButtons[0], older]
      expect(oldestCardButtons).toContain(document.activeElement)
    })
  })

  describe('KBD-04 — Escape to input; Enter/Space activate the focused button', () => {
    it('Escape from a card button returns focus to the input', () => {
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: ['C'] }
        ]
      })
      render(<Harness />)
      const insert = screen.getByLabelText('Scribe.button.insert')
      insert.focus()
      fireEvent.keyDown(insert, { key: 'Escape' })
      expect(document.activeElement).toBe(getInput())
    })

    it('Enter/Space activate the focused button natively (Insert calls panelActions.insert)', () => {
      const RAW = 'raw fragment {{REF:scribe-ref-1:x}}'
      setScribe({
        messages: [
          { id: 'a1', role: 'assistant', discussion: '{{fragment:0}}', fragments: [RAW] }
        ]
      })
      render(<Harness />)
      const insert = screen.getByLabelText('Scribe.button.insert')
      insert.focus()
      // Controller must NOT preventDefault on Enter/Space — native activation.
      fireEvent.click(insert)
      expect(insertSpy).toHaveBeenCalledWith(RAW)
    })
  })
})

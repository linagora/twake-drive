import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Light theme mock mirroring FragmentCard.spec.jsx — ChatMessageList and the
// nested AssistantBubble / FragmentCard / MessageActions / MarkdownPreview read
// palette.text/action/divider/grey/primary/error.
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
      action: { hover: 'rgba(0,0,0,0.04)', selected: 'rgba(0,0,0,0.08)' }
    }
  })
}))

// Tooltip is a passthrough wrapper so the inner <button> stays queryable.
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

// i18n: echo the key so aria-labels are 'Scribe.button.copy' etc.
jest.mock('twake-i18n', () => ({
  __esModule: true,
  useI18n: () => ({ t: key => key })
}))

// Controllable useScribe — each test sets `scribeState` before render. The
// panelActions bridge is spied (FragmentCard's MessageActions reads it).
let scribeState
const insertSpy = jest.fn()
const replaceSpy = jest.fn()
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeContext', () => ({
  __esModule: true,
  useScribe: () => scribeState
}))

import { ChatMessageList } from '@/modules/views/OnlyOffice/Scribe/ChatMessageList'

const setScribe = ({ messages, isLoading = false, currentSelection = null }) => {
  scribeState = {
    messages,
    isLoading,
    currentSelection,
    panelActions: { insert: insertSpy, replace: replaceSpy }
  }
}

const assistant = (over = {}) => ({ id: 'a1', role: 'assistant', ...over })

describe('ChatMessageList — segment-based assistant render', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    scribeState = undefined
  })

  describe('FRAG-01 — cards at {{fragment:N}} marker positions', () => {
    it('renders a card for FRAG0 between prose A and prose B (document order)', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'A {{fragment:0}} B', fragments: ['FRAG0'] })
        ]
      })
      const { container } = render(<ChatMessageList />)

      // The card is identifiable by its action buttons.
      const cards = screen.getAllByLabelText('Scribe.button.insert')
      expect(cards).toHaveLength(1)

      const text = container.textContent
      expect(text).toContain('A')
      expect(text).toContain('FRAG0')
      expect(text).toContain('B')
      // Order: A ... FRAG0 ... B
      expect(text.indexOf('A')).toBeLessThan(text.indexOf('FRAG0'))
      expect(text.indexOf('FRAG0')).toBeLessThan(text.indexOf('B'))
    })
  })

  describe('D-04 — orphan fragments render as cards at the end', () => {
    it('renders two cards after the prose when fragments are unreferenced', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'just prose', fragments: ['X', 'Y'] })
        ]
      })
      const { container } = render(<ChatMessageList />)

      expect(screen.getAllByLabelText('Scribe.button.insert')).toHaveLength(2)
      const text = container.textContent
      expect(text).toContain('just prose')
      expect(text).toContain('X')
      expect(text).toContain('Y')
      expect(text.indexOf('just prose')).toBeLessThan(text.indexOf('X'))
      expect(text.indexOf('X')).toBeLessThan(text.indexOf('Y'))
    })
  })

  describe('CONTRACT-02 / D-05 — 0-fragment response renders discussion only', () => {
    it('renders the discussion text and ZERO action buttons and no card', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'pure discussion', fragments: [] })
        ]
      })
      const { container } = render(<ChatMessageList />)

      expect(container.textContent).toContain('pure discussion')
      expect(screen.queryByLabelText('Scribe.button.copy')).toBeNull()
      expect(screen.queryByLabelText('Scribe.button.insert')).toBeNull()
      expect(screen.queryByLabelText('Scribe.button.replace')).toBeNull()
    })

    it('shows no insertion UI even when a selection is active (D-05)', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'pure discussion', fragments: [] })
        ],
        currentSelection: { text: 'sel' }
      })
      render(<ChatMessageList />)
      expect(screen.queryByLabelText('Scribe.button.insert')).toBeNull()
      expect(screen.queryByLabelText('Scribe.button.replace')).toBeNull()
    })
  })

  describe('no empty bubble — 0 fragments + empty discussion renders nothing', () => {
    it('renders no assistant container for an empty contract message', () => {
      setScribe({
        messages: [assistant({ discussion: '   ', fragments: [] })]
      })
      const { container } = render(<ChatMessageList />)
      // Only the scroll container exists; no bubble text, no actions.
      expect(container.textContent.trim()).toBe('')
      expect(screen.queryByLabelText('Scribe.button.copy')).toBeNull()
    })
  })

  describe('D-08 — message-level actions removed; actions live only on cards', () => {
    it('a 0-fragment message shows no action buttons at all', () => {
      setScribe({
        messages: [assistant({ discussion: 'discussion only', fragments: [] })]
      })
      render(<ChatMessageList />)
      expect(screen.queryByLabelText('Scribe.button.copy')).toBeNull()
      expect(screen.queryByLabelText('Scribe.button.insert')).toBeNull()
    })

    it('a carded message exposes action buttons only inside cards (one set per fragment)', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'A {{fragment:0}} B', fragments: ['FRAG0'] })
        ]
      })
      render(<ChatMessageList />)
      // Exactly one Copy + one Insert (the single card's buttons) — no extra
      // message-level action bar.
      expect(screen.getAllByLabelText('Scribe.button.copy')).toHaveLength(1)
      expect(screen.getAllByLabelText('Scribe.button.insert')).toHaveLength(1)
    })

    it('shows Replace inside the card when a selection is active', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'A {{fragment:0}} B', fragments: ['FRAG0'] })
        ],
        currentSelection: { text: 'sel' }
      })
      render(<ChatMessageList />)
      expect(screen.getAllByLabelText('Scribe.button.replace')).toHaveLength(1)
    })

    it('hides Replace inside the card when there is no selection', () => {
      setScribe({
        messages: [
          assistant({ discussion: 'A {{fragment:0}} B', fragments: ['FRAG0'] })
        ],
        currentSelection: null
      })
      render(<ChatMessageList />)
      expect(screen.queryByLabelText('Scribe.button.replace')).toBeNull()
    })
  })

  describe('backward-compat — legacy message (no discussion/fragments)', () => {
    it('renders content as a single prose bubble, no cards, no actions', () => {
      setScribe({
        messages: [{ id: 'legacy', role: 'assistant', content: 'old text' }]
      })
      const { container } = render(<ChatMessageList />)
      expect(container.textContent).toContain('old text')
      expect(screen.queryByLabelText('Scribe.button.copy')).toBeNull()
      expect(screen.queryByLabelText('Scribe.button.insert')).toBeNull()
    })
  })

  describe('user / error branches unchanged', () => {
    it('renders a user message bubble', () => {
      setScribe({
        messages: [{ id: 'u1', role: 'user', content: 'hi there' }]
      })
      const { container } = render(<ChatMessageList />)
      expect(container.textContent).toContain('hi there')
    })

    it('renders an error message bubble', () => {
      setScribe({
        messages: [{ id: 'e1', role: 'error', content: 'boom' }]
      })
      const { container } = render(<ChatMessageList />)
      expect(container.textContent).toContain('boom')
      expect(container.textContent).toContain('Scribe.chat.error_prefix')
    })
  })

  describe('D-03 — card actions receive the raw fragment (markers intact)', () => {
    it('passes the verbatim raw fragment to panelActions.insert', () => {
      const RAW = 'See {{REF:scribe-ref-1:Fig 1}} done'
      setScribe({
        messages: [
          assistant({ discussion: 'lead {{fragment:0}}', fragments: [RAW] })
        ]
      })
      render(<ChatMessageList />)
      fireEvent.click(screen.getByLabelText('Scribe.button.insert'))
      expect(insertSpy).toHaveBeenCalledTimes(1)
      expect(insertSpy.mock.calls[0][0]).toBe(RAW)
    })
  })
})

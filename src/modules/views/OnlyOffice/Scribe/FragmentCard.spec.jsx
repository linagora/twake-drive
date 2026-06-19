import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Light theme mock mirroring MarkdownPreview.spec.jsx — FragmentCard + the
// embedded MessageActions read palette.text/action/divider/grey/primary.
jest.mock('cozy-ui/transpiled/react/styles', () => ({
  __esModule: true,
  useTheme: () => ({
    palette: {
      type: 'light',
      text: { primary: '#000', secondary: '#555' },
      divider: '#ddd',
      grey: { 50: '#fafafa', 800: '#333' },
      primary: { main: '#7C3AED' },
      action: { hover: 'rgba(0,0,0,0.04)' }
    }
  })
}))

// Tooltip is a passthrough wrapper so the inner <button> stays queryable.
jest.mock('cozy-ui/transpiled/react/Tooltip', () => ({
  __esModule: true,
  default: ({ children }) => children
}))

// i18n: return the key verbatim so aria-labels are 'Scribe.button.copy' etc.
jest.mock('twake-i18n', () => ({
  __esModule: true,
  useI18n: () => ({ t: key => key })
}))

// Spies for the panelActions bridge — the D-03 guard asserts these receive the
// VERBATIM raw fragment (markers intact), never the cosmetically cleaned string.
const insertSpy = jest.fn()
const replaceSpy = jest.fn()
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeContext', () => ({
  __esModule: true,
  useScribe: () => ({ panelActions: { insert: insertSpy, replace: replaceSpy } })
}))

import { FragmentCard } from '@/modules/views/OnlyOffice/Scribe/FragmentCard'

describe('FragmentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('FRAG-02 — three actions per card', () => {
    it('renders Copy, Insert and Replace buttons when a selection is active', () => {
      render(<FragmentCard raw="hello" hasSelection />)
      expect(screen.getByLabelText('Scribe.button.copy')).toBeInTheDocument()
      expect(screen.getByLabelText('Scribe.button.insert')).toBeInTheDocument()
      expect(screen.getByLabelText('Scribe.button.replace')).toBeInTheDocument()
    })
  })

  describe('FRAG-04 / D-07 — Replace gated on selection', () => {
    it('hides Replace when no selection is active (only Copy + Insert)', () => {
      render(<FragmentCard raw="hello" hasSelection={false} />)
      expect(screen.getByLabelText('Scribe.button.copy')).toBeInTheDocument()
      expect(screen.getByLabelText('Scribe.button.insert')).toBeInTheDocument()
      expect(
        screen.queryByLabelText('Scribe.button.replace')
      ).not.toBeInTheDocument()
    })
  })

  describe('FRAG-03 / D-03 — actions operate on the RAW fragment (markers intact)', () => {
    const RAW = 'See {{REF:scribe-ref-1:Fig 1}} and [^scribe-fn-2]'

    it('passes the verbatim raw string to panelActions.insert on Insert', () => {
      render(<FragmentCard raw={RAW} hasSelection />)
      fireEvent.click(screen.getByLabelText('Scribe.button.insert'))
      expect(insertSpy).toHaveBeenCalledTimes(1)
      const arg = insertSpy.mock.calls[0][0]
      expect(arg).toBe(RAW)
      expect(arg).toContain('{{REF:scribe-ref-1:Fig 1}}')
      expect(arg).toContain('[^scribe-fn-2]')
    })

    it('passes the verbatim raw string to panelActions.replace on Replace', () => {
      render(<FragmentCard raw={RAW} hasSelection />)
      fireEvent.click(screen.getByLabelText('Scribe.button.replace'))
      expect(replaceSpy).toHaveBeenCalledTimes(1)
      const arg = replaceSpy.mock.calls[0][0]
      expect(arg).toBe(RAW)
      expect(arg).toContain('{{REF:scribe-ref-1:Fig 1}}')
      expect(arg).toContain('[^scribe-fn-2]')
    })

    it('shows the cosmetic display (visible REF text) while the action still gets the raw marker', () => {
      const { container } = render(<FragmentCard raw={RAW} hasSelection />)
      // Display is cosmetically cleaned by MarkdownPreview: visible text only.
      expect(container.textContent).toContain('Fig 1')
      expect(container.textContent).not.toContain('{{REF:scribe-ref-1')
      // But the action still receives the verbatim raw — proving the split.
      fireEvent.click(screen.getByLabelText('Scribe.button.insert'))
      expect(insertSpy.mock.calls[0][0]).toBe(RAW)
    })
  })

  describe('D-01 — bordered Scribe-purple card', () => {
    it('renders a card root with a Scribe-purple border', () => {
      const { container } = render(<FragmentCard raw="hello" hasSelection />)
      const root = container.firstChild
      const border = (root.getAttribute('style') || '').toLowerCase()
      // Accept hex or rgb form of #7C3AED.
      expect(
        border.includes('7c3aed') || border.includes('124, 58, 237')
      ).toBe(true)
    })
  })
})

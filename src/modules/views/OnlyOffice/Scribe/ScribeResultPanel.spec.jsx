import { render, screen } from '@testing-library/react'
import React from 'react'

// Light theme mock mirroring FragmentCard.spec.jsx / MarkdownPreview.spec.jsx —
// ScribeResultPanel + the embedded MarkdownPreview read palette.text/action/
// divider/grey/primary/error.
jest.mock('cozy-ui/transpiled/react/styles', () => ({
  __esModule: true,
  useTheme: () => ({
    palette: {
      type: 'light',
      text: { primary: '#000', secondary: '#555' },
      divider: '#ddd',
      grey: { 50: '#fafafa', 800: '#333' },
      primary: { main: '#7C3AED' },
      error: { main: '#d32f2f' },
      action: { hover: 'rgba(0,0,0,0.04)' }
    }
  })
}))

// i18n: return the key verbatim so labels are 'Scribe.button.insert' etc.
jest.mock('twake-i18n', () => ({
  __esModule: true,
  useI18n: () => ({ t: key => key })
}))

// cozy-ui leaf components → light passthroughs so the DOM stays queryable and
// jsdom doesn't choke on transpiled cozy-ui internals.
jest.mock('cozy-ui/transpiled/react/Buttons', () => ({
  __esModule: true,
  default: React.forwardRef(({ label, onClick, disabled }, ref) => (
    <button ref={ref} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  ))
}))
jest.mock('cozy-ui/transpiled/react/IconButton', () => ({
  __esModule: true,
  default: React.forwardRef(({ children, onClick }, ref) => (
    <button ref={ref} onClick={onClick}>
      {children}
    </button>
  ))
}))
jest.mock('cozy-ui/transpiled/react/Icon', () => ({
  __esModule: true,
  default: () => <span data-icon />
}))
jest.mock('cozy-ui/transpiled/react/Icons/Cross', () => ({
  __esModule: true,
  default: 'cross'
}))
jest.mock('cozy-ui/transpiled/react/Icons/Sync', () => ({
  __esModule: true,
  default: 'sync'
}))
jest.mock('cozy-ui/transpiled/react/Checkbox', () => ({
  __esModule: true,
  default: () => <input type="checkbox" />
}))
jest.mock('cozy-ui/transpiled/react/Paper', () => ({
  __esModule: true,
  default: React.forwardRef(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ))
}))
jest.mock('cozy-ui/transpiled/react/Typography', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>
}))

import { ScribeResultPanel } from '@/modules/views/OnlyOffice/Scribe/ScribeResultPanel'

const baseProps = {
  breadcrumb: 'Corriger la grammaire',
  onReplace: jest.fn(),
  onInsert: jest.fn(),
  onClose: jest.fn()
}

describe('ScribeResultPanel — popover result card (v3.1-05-01)', () => {
  describe('D-01 — Scribe-violet card frame', () => {
    it('renders the fragment inside a #7C3AED-bordered card container', () => {
      const { container } = render(
        <ScribeResultPanel
          {...baseProps}
          resultText="display"
          rawFragment="hello world"
        />
      )
      const card = container.querySelector('[data-scribe-result-card]')
      expect(card).not.toBeNull()
      const style = (card.getAttribute('style') || '').toLowerCase()
      expect(
        style.includes('7c3aed') || style.includes('124, 58, 237')
      ).toBe(true)
    })
  })

  describe('D-02 — card body renders the RAW fragment via MarkdownPreview', () => {
    const RAW = 'See {{REF:scribe-ref-1:Fig 1}} and [^scribe-fn-2]'

    it('cosmetically cleans the RAW markers for display (REF text visible, marker hidden)', () => {
      const { container } = render(
        <ScribeResultPanel
          {...baseProps}
          resultText="IGNORED display string"
          rawFragment={RAW}
        />
      )
      // MarkdownPreview cleans markers cosmetically: visible text only.
      expect(container.textContent).toContain('Fig 1')
      expect(container.textContent).not.toContain('{{REF:scribe-ref-1')
      // The cosmetic resultText is NOT what the card body renders.
      expect(container.textContent).not.toContain('IGNORED display string')
    })

    it('does not crash on an empty/whitespace fragment and still renders the card frame', () => {
      const { container } = render(
        <ScribeResultPanel {...baseProps} resultText="" rawFragment="   " />
      )
      expect(
        container.querySelector('[data-scribe-result-card]')
      ).not.toBeNull()
    })
  })

  describe('footer + popover-specific surfaces preserved', () => {
    it('keeps the Insert and Replace footer buttons', () => {
      render(
        <ScribeResultPanel
          {...baseProps}
          resultText="x"
          rawFragment="x"
        />
      )
      expect(
        screen.getByText('Scribe.button.insert')
      ).toBeInTheDocument()
      expect(
        screen.getByText('Scribe.button.replace')
      ).toBeInTheDocument()
    })

    it('renders the cellWarning banner above the card when set', () => {
      const { container } = render(
        <ScribeResultPanel
          {...baseProps}
          resultText="x"
          rawFragment="x"
          cellWarning="partial table selection"
        />
      )
      expect(container.textContent).toContain('partial table selection')
    })

    it('renders the error message (no card) when error is set', () => {
      render(
        <ScribeResultPanel
          {...baseProps}
          resultText="x"
          rawFragment="x"
          error="boom"
        />
      )
      expect(screen.getByText('boom')).toBeInTheDocument()
    })
  })
})

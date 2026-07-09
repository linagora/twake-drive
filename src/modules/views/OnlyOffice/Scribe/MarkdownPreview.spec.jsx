import { render, screen } from '@testing-library/react'
import React from 'react'

// Minimal light theme mirroring how ScribeContainer.spec.jsx mocks cozy-ui.
// MarkdownPreview reads palette.text/divider/grey/primary + palette.type/mode.
jest.mock('cozy-ui/transpiled/react/styles', () => ({
  __esModule: true,
  useTheme: () => ({
    palette: {
      type: 'light',
      text: { primary: '#000', secondary: '#555' },
      divider: '#ddd',
      grey: { 50: '#fafafa', 800: '#333' },
      primary: { main: '#7C3AED' }
    }
  })
}))

import { MarkdownPreview } from '@/modules/views/OnlyOffice/Scribe/MarkdownPreview'

describe('MarkdownPreview — D-02 cosmetic marker transforms', () => {
  describe('REF markers → visible text only', () => {
    it('renders only the visible text of a REF marker, never the literal marker', () => {
      const { container } = render(
        <MarkdownPreview>{'See {{REF:scribe-ref-3:Figure 7}} here'}</MarkdownPreview>
      )
      expect(container.textContent).toContain('Figure 7')
      expect(container.textContent).not.toContain('{{REF:scribe-ref-3')
      expect(container.textContent).not.toContain('scribe-ref-3')
    })

    it('reduces multiple REF markers each to their visible text', () => {
      const { container } = render(
        <MarkdownPreview>
          {'cf {{REF:scribe-ref-1:Tableau 1}} et {{REF:scribe-ref-2:Annexe B}}'}
        </MarkdownPreview>
      )
      expect(container.textContent).toContain('Tableau 1')
      expect(container.textContent).toContain('Annexe B')
      expect(container.textContent).not.toContain('REF:scribe-ref')
    })
  })

  describe('footnote markers → discreet superscript', () => {
    it('renders a <sup> containing the footnote number, not the literal marker', () => {
      const { container } = render(
        <MarkdownPreview>{'Claim[^scribe-fn-2]'}</MarkdownPreview>
      )
      const sup = container.querySelector('sup')
      expect(sup).not.toBeNull()
      expect(sup.textContent).toContain('2')
      expect(container.textContent).not.toContain('[^scribe-fn-2]')
    })
  })

  describe('TABLE/CELL markers → rendered pipe-table', () => {
    it('renders a <table> from a [TABLE:N]/[CELL:r,c] marker block', () => {
      const md =
        '[TABLE:0][CELL:0,0]Name[/CELL][CELL:0,1]Age[/CELL]' +
        '[CELL:1,0]Alice[/CELL][CELL:1,1]30[/CELL][/TABLE]'
      const { container } = render(<MarkdownPreview>{md}</MarkdownPreview>)
      const table = container.querySelector('table')
      expect(table).not.toBeNull()
      expect(container.textContent).toContain('Name')
      expect(container.textContent).toContain('Alice')
      expect(container.textContent).not.toContain('[TABLE:')
      expect(container.textContent).not.toContain('[CELL:')
    })
  })

  describe('idempotency — already-converted pipe-table passes through once', () => {
    it('renders an existing GFM pipe-table exactly once (not double-transformed)', () => {
      const md = ['| H1 | H2 |', '| --- | --- |', '| a | b |'].join('\n')
      const { container } = render(<MarkdownPreview>{md}</MarkdownPreview>)
      const tables = container.querySelectorAll('table')
      expect(tables.length).toBe(1)
      // cell text appears exactly once
      const occurrences = (container.textContent.match(/H1/g) || []).length
      expect(occurrences).toBe(1)
    })
  })

  describe('GATE §8 passthrough — unmatched/partial markers never throw', () => {
    it('renders surrounding text when a footnote marker is unclosed', () => {
      expect(() =>
        render(<MarkdownPreview>{'before [^scribe-fn- after'}</MarkdownPreview>)
      ).not.toThrow()
      expect(screen.getByText(/before/)).toBeInTheDocument()
      expect(screen.getByText(/after/)).toBeInTheDocument()
    })

    it('renders surrounding text when a REF marker is unclosed', () => {
      const { container } = render(
        <MarkdownPreview>{'x {{REF:scribe-ref-9:partial y'}</MarkdownPreview>
      )
      expect(container.textContent).toContain('x ')
      expect(container.textContent).toContain('partial y')
    })
  })

  describe('no-mutation contract (D-03) — input string is never mutated', () => {
    it('leaves the caller source string byte-identical after render', () => {
      const src = 'See {{REF:scribe-ref-3:Figure 7}} and Claim[^scribe-fn-2]'
      const before = src
      render(<MarkdownPreview>{src}</MarkdownPreview>)
      // Strings are immutable in JS, but assert identity/equality explicitly:
      // the displayed DOM must differ from the verbatim source while `src` is unchanged.
      expect(src).toBe(before)
      expect(src).toBe('See {{REF:scribe-ref-3:Figure 7}} and Claim[^scribe-fn-2]')
    })

    it('produces cleaned DOM that differs from the verbatim raw source', () => {
      const src = 'See {{REF:scribe-ref-3:Figure 7}} here'
      const { container } = render(<MarkdownPreview>{src}</MarkdownPreview>)
      // DOM is cleaned (no marker) while src still carries the marker.
      expect(container.textContent).not.toBe(src)
      expect(src).toContain('{{REF:scribe-ref-3')
      expect(container.textContent).not.toContain('{{REF:scribe-ref-3')
    })
  })
})

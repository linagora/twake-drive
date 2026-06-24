import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Light theme mock — ScribeIncludeZone reads palette.text.secondary.
jest.mock('cozy-ui/transpiled/react/styles', () => ({
  __esModule: true,
  useTheme: () => ({
    palette: {
      type: 'light',
      text: { primary: '#000', secondary: '#555' },
      divider: '#ddd',
      primary: { main: '#7C3AED' }
    }
  })
}))

// Checkbox passthrough: render a native checkbox so checked/onChange/aria-label
// are queryable and clickable in jsdom.
jest.mock('cozy-ui/transpiled/react/Checkbox', () => ({
  __esModule: true,
  default: ({ checked, onChange, ...rest }) => (
    <input type="checkbox" checked={!!checked} onChange={onChange} {...rest} />
  )
}))

// i18n: echo the key so labels/aria-labels equal 'Scribe.include.*'.
jest.mock('twake-i18n', () => ({
  __esModule: true,
  useI18n: () => ({ t: key => key })
}))

// Controllable useScribe — each test sets `scribeState` before render.
let scribeState
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeContext', () => ({
  __esModule: true,
  useScribe: () => scribeState
}))

import { ScribeIncludeZone } from '@/modules/views/OnlyOffice/Scribe/ScribeIncludeZone'

const setIncludeDocument = jest.fn()
const setIncludeDiscussion = jest.fn()
const setIncludeSelection = jest.fn()
const dismissSelection = jest.fn()

const setScribe = (over = {}) => {
  scribeState = {
    currentSelection: null,
    includeDocument: false,
    includeDiscussion: false,
    includeSelection: true,
    setIncludeDocument,
    setIncludeDiscussion,
    setIncludeSelection,
    dismissSelection,
    ...over
  }
}

const selection = { text: 'hello', markdown: 'hello' }

beforeEach(() => {
  jest.clearAllMocks()
  setScribe()
})

describe('ScribeIncludeZone — static « Inclure » zone', () => {
  it('renders the caption via t(Scribe.include.label) inside a role=group', () => {
    render(<ScribeIncludeZone />)
    expect(screen.getByText('Scribe.include.label')).toBeInTheDocument()
    const group = screen.getByRole('group')
    expect(group).toHaveAttribute('aria-label', 'Scribe.include.label')
  })

  it('renders document and discussion checkboxes UNCHECKED by default', () => {
    render(<ScribeIncludeZone />)
    const doc = screen.getByLabelText('Scribe.include.document')
    const disc = screen.getByLabelText('Scribe.include.discussion')
    expect(doc).not.toBeChecked()
    expect(disc).not.toBeChecked()
  })

  it('always renders document and discussion labels via t() (no hard-coded strings)', () => {
    render(<ScribeIncludeZone />)
    expect(screen.getByText('Scribe.include.document')).toBeInTheDocument()
    expect(screen.getByText('Scribe.include.discussion')).toBeInTheDocument()
  })

  it('OMITS the « sélection » checkbox when there is no selection', () => {
    render(<ScribeIncludeZone />)
    expect(screen.queryByLabelText('Scribe.include.selection')).toBeNull()
  })

  it('mounts the aria-live wrapper in BOTH states (empty when no selection)', () => {
    const { container } = render(<ScribeIncludeZone />)
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })

  it('shows « sélection » CHECKED by default when a selection exists', () => {
    setScribe({ currentSelection: selection, includeSelection: true })
    render(<ScribeIncludeZone />)
    const sel = screen.getByLabelText('Scribe.include.selection')
    expect(sel).toBeInTheDocument()
    expect(sel).toBeChecked()
    // aria-live wrapper still present alongside the now-mounted checkbox.
    const { baseElement } = screen
    expect(
      document.querySelector('[aria-live="polite"]')
    ).toBeInTheDocument()
  })

  it('toggling « sélection » calls setIncludeSelection (context setter), NOT dismissSelection', () => {
    setScribe({ currentSelection: selection, includeSelection: true })
    render(<ScribeIncludeZone />)
    fireEvent.click(screen.getByLabelText('Scribe.include.selection'))
    expect(setIncludeSelection).toHaveBeenCalled()
    expect(dismissSelection).not.toHaveBeenCalled()
  })

  it('toggling « document » invokes the context setter (state lives in context)', () => {
    render(<ScribeIncludeZone />)
    fireEvent.click(screen.getByLabelText('Scribe.include.document'))
    expect(setIncludeDocument).toHaveBeenCalled()
  })

  it('toggling « discussion » invokes the context setter (state lives in context)', () => {
    render(<ScribeIncludeZone />)
    fireEvent.click(screen.getByLabelText('Scribe.include.discussion'))
    expect(setIncludeDiscussion).toHaveBeenCalled()
  })

  it('reflects an externally-unchecked « sélection » (value comes from context)', () => {
    setScribe({ currentSelection: selection, includeSelection: false })
    render(<ScribeIncludeZone />)
    expect(screen.getByLabelText('Scribe.include.selection')).not.toBeChecked()
  })
})

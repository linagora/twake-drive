import { render, screen } from '@testing-library/react'
import React from 'react'

const mockDocsAvailable = jest.fn()
const mockExcalidrawAvailable = jest.fn()
const mockGristAvailable = jest.fn()
const mockOnlyOfficeAvailable = jest.fn()

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isDesktop: true })
}))

// Gating now lives in the registry (`create.isAvailable`), tested in
// registry.spec; here we only drive the add-menu wiring/order. Mock the
// registry with the order the add menu relies on (see editor/registry.js),
// `pdf` having no create entry so it must be skipped.
jest.mock('@/modules/views/editor/registry', () => ({
  EDITORS: [
    {
      slug: 'docs',
      create: { isAvailable: (...a) => mockDocsAvailable(...a) }
    },
    {
      slug: 'excalidraw',
      create: { isAvailable: (...a) => mockExcalidrawAvailable(...a) }
    },
    {
      slug: 'grist',
      create: { isAvailable: (...a) => mockGristAvailable(...a) }
    },
    {
      slug: 'onlyoffice',
      create: { isAvailable: (...a) => mockOnlyOfficeAvailable(...a) }
    },
    { slug: 'pdf' }
  ]
}))

jest.mock('@/modules/drive/Toolbar/components/CreateNoteItem', () => () => (
  <div data-testid="item-note" />
))
jest.mock('@/modules/drive/Toolbar/components/CreateDocsItem', () => () => (
  <div data-testid="item-docs" />
))
jest.mock(
  '@/modules/drive/Toolbar/components/CreateExcalidrawItem',
  () => () => <div data-testid="item-excalidraw" />
)
jest.mock('@/modules/drive/Toolbar/components/CreateGristItem', () => () => (
  <div data-testid="item-grist" />
))
jest.mock(
  '@/modules/drive/Toolbar/components/CreateOnlyOfficeItem',
  () =>
    ({ fileClass }) => <div data-testid={`item-onlyoffice-${fileClass}`} />
)

import CreateDocumentItems from './CreateDocumentItems'

const renderItems = (props = {}) =>
  render(
    <CreateDocumentItems
      isPublic={false}
      canUpload={true}
      displayedFolder={{ _id: 'folder-1' }}
      isReadOnly={false}
      onClick={jest.fn()}
      {...props}
    />
  )

describe('CreateDocumentItems', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDocsAvailable.mockReturnValue(true)
    mockExcalidrawAvailable.mockReturnValue(true)
    mockGristAvailable.mockReturnValue(true)
    mockOnlyOfficeAvailable.mockReturnValue(true)
  })

  it('renders the note item and every available editor entry in registry order', () => {
    renderItems()

    const testIds = screen
      .getAllByTestId(/^item-/)
      .map(node => node.dataset.testid)

    expect(testIds).toEqual([
      'item-note',
      'item-docs',
      'item-excalidraw',
      'item-grist',
      'item-onlyoffice-text',
      'item-onlyoffice-spreadsheet',
      'item-onlyoffice-slide'
    ])
  })

  it('hides the note item on a public link', () => {
    renderItems({ isPublic: true })

    expect(screen.queryByTestId('item-note')).toBe(null)
  })

  it('skips editors whose registry create gate returns false', () => {
    mockDocsAvailable.mockReturnValue(false)
    mockOnlyOfficeAvailable.mockReturnValue(false)
    renderItems()

    expect(screen.queryByTestId('item-docs')).toBe(null)
    expect(screen.queryByTestId('item-onlyoffice-text')).toBe(null)
    expect(screen.getByTestId('item-excalidraw')).toBeInTheDocument()
    expect(screen.getByTestId('item-grist')).toBeInTheDocument()
  })

  it('passes the add-menu context to the registry create gate', () => {
    renderItems({ isPublic: true, canUpload: false })

    expect(mockExcalidrawAvailable).toHaveBeenCalledWith({
      isPublic: true,
      canUpload: false,
      isDesktop: true
    })
  })
})

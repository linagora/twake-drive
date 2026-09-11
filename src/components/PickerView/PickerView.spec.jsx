import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { PickerView } from './PickerView'

jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('@/modules/filelist/icons/FileThumbnail', () => () => (
  <div data-testid="file-thumbnail">Thumbnail</div>
))

const mockItems = [
  { _id: 'item-1', name: 'File 1.pdf', type: 'file' },
  { _id: 'item-2', name: 'File 2.png', type: 'file' }
]

const mockBreadcrumbPath = [
  { id: 'root-id', name: 'My Drive' },
  { id: 'subfolder-id', name: 'Subfolder' }
]

function setup({
  items = mockItems,
  fetchStatus = 'loaded',
  error = null,
  isSectionChanging = false,
  onSectionReady = jest.fn(),
  onBreadcrumbClick = jest.fn(),
  emptyMessage
} = {}) {
  useBreakpoints.mockReturnValue({ isMobile: false })
  useI18n.mockReturnValue({ t: key => key, f: val => String(val) })

  const result = render(
    <PickerView
      items={items}
      breadcrumbPath={mockBreadcrumbPath}
      onBreadcrumbClick={onBreadcrumbClick}
      fetchStatus={fetchStatus}
      error={error}
      isSectionChanging={isSectionChanging}
      onSectionReady={onSectionReady}
      emptyMessage={emptyMessage}
    />
  )

  return { ...result, onSectionReady, onBreadcrumbClick }
}

describe('PickerView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useBreakpoints.mockReturnValue({ isMobile: false })
    useI18n.mockReturnValue({ t: key => key, f: val => String(val) })
  })

  it('renders breadcrumbs and handles navigation', () => {
    const { onBreadcrumbClick } = setup()

    expect(screen.getByTestId('file-picker-breadcrumb')).toBeInTheDocument()
    const ancestorBtn = screen.getByRole('button', { name: 'My Drive' })
    fireEvent.click(ancestorBtn)
    expect(onBreadcrumbClick).toHaveBeenCalledWith(mockBreadcrumbPath[0])
  })

  it('renders loading skeleton when fetchStatus is loading', () => {
    setup({ fetchStatus: 'loading' })

    expect(screen.getByTestId('file-picker-loading')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('renders source error when fetchStatus is failed', () => {
    setup({ fetchStatus: 'failed' })

    expect(screen.getByTestId('file-picker-source-error')).toHaveTextContent(
      'error.open_folder'
    )
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('renders default inline error message with FilePicker prefix', () => {
    setup({ error: 'ITEM_NOT_FOUND' })

    expect(screen.getByTestId('file-picker-error')).toHaveTextContent(
      'FilePicker.errors.ITEM_NOT_FOUND'
    )
  })

  it('renders empty message when items list is empty and loaded', () => {
    setup({ items: [] })

    expect(screen.getByTestId('file-picker-empty')).toHaveTextContent(
      'empty.title'
    )
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('renders custom empty message when provided', () => {
    setup({
      items: [],
      emptyMessage: <div data-testid="custom-empty">Custom empty message</div>
    })

    expect(screen.getByTestId('custom-empty')).toBeInTheDocument()
  })

  it('handles section transition readiness', () => {
    const onSectionReady = jest.fn()
    setup({ isSectionChanging: true, fetchStatus: 'loaded', onSectionReady })

    expect(onSectionReady).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('table')).toBe(null)
  })

  it('renders the fixed PickerViewTable assembly', () => {
    render(<PickerView items={mockItems} breadcrumbPath={mockBreadcrumbPath} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

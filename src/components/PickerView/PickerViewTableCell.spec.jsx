import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { PickerViewTableCell } from './PickerViewTableCell'

jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))

jest.mock('@/modules/filelist/icons/FileThumbnail', () => () => (
  <div data-testid="file-thumbnail">Thumbnail</div>
))
jest.mock(
  '@/modules/filelist/virtualized/cells/columns/UpdatedAtCell',
  () =>
    ({ cell }) => <div data-testid="updated-at-cell">{cell}</div>
)
jest.mock(
  '@/modules/filelist/virtualized/cells/columns/SizeCell',
  () =>
    ({ cell }) => <div data-testid="size-cell">{cell}</div>
)

const mockFile = {
  _id: 'file-1',
  name: 'document.pdf',
  type: 'file',
  size: 1024,
  updated_at: '2025-01-01T12:00:00.000Z'
}

const mockFolder = {
  _id: 'folder-1',
  name: 'Photos',
  type: 'directory'
}

describe('PickerViewTableCell', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useI18n.mockReturnValue({ t: key => key, f: val => String(val) })
    useBreakpoints.mockReturnValue({ isMobile: false })
  })

  it('renders filename and thumbnail for name column on desktop without checkboxes', () => {
    render(
      <PickerViewTableCell
        column={{ id: 'name' }}
        row={mockFile}
        selectionModeActive={false}
      />
    )

    expect(screen.getByTestId('file-thumbnail')).toBeInTheDocument()
    expect(screen.getByTitle('document.pdf')).toBeInTheDocument()
    expect(screen.getByText('.pdf')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).toBe(null)
  })

  it('renders checked checkbox on mobile when selectionModeActive and item is selected', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })

    render(
      <PickerViewTableCell
        column={{ id: 'name' }}
        row={mockFile}
        selectionModeActive={true}
        isSelectedItem={item => item._id === 'file-1'}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).toBeChecked()
  })

  it('renders unchecked checkbox on mobile when selectionModeActive and item is not selected', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })

    render(
      <PickerViewTableCell
        column={{ id: 'name' }}
        row={mockFile}
        selectionModeActive={true}
        isSelectedItem={() => false}
      />
    )

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('renders mobile metadata for files but not for folders', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })

    const { rerender } = render(
      <PickerViewTableCell
        column={{ id: 'name' }}
        row={mockFile}
        selectionModeActive={false}
      />
    )

    expect(screen.getByText(/1.02 kB/)).toBeInTheDocument()

    rerender(
      <PickerViewTableCell
        column={{ id: 'name' }}
        row={mockFolder}
        selectionModeActive={false}
      />
    )

    expect(screen.queryByText(/1.02 kB/)).toBe(null)
  })

  it('opens folders through the navigation control without selecting the row', () => {
    const onItemNavigate = jest.fn()

    render(
      <PickerViewTableCell
        column={{ id: 'name' }}
        row={mockFolder}
        selectionModeActive={false}
        onItemNavigate={onItemNavigate}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Move.openFolder' }))

    expect(onItemNavigate).toHaveBeenCalledWith(mockFolder)
  })

  it('renders updated_at and size cells for respective columns', () => {
    const { rerender } = render(
      <PickerViewTableCell
        column={{ id: 'updated_at' }}
        row={mockFile}
        selectionModeActive={false}
      />
    )

    expect(screen.getByTestId('updated-at-cell')).toHaveTextContent(
      '2025-01-01T12:00:00.000Z'
    )

    rerender(
      <PickerViewTableCell
        column={{ id: 'size' }}
        row={mockFile}
        selectionModeActive={false}
      />
    )

    expect(screen.getByTestId('size-cell')).toHaveTextContent('1024')
  })

  it('returns null for unknown column or missing row/column', () => {
    const { container, rerender } = render(
      <PickerViewTableCell column={{ id: 'unknown' }} row={mockFile} />
    )
    expect(container.firstChild).toBe(null)

    rerender(<PickerViewTableCell column={null} row={mockFile} />)
    expect(container.firstChild).toBe(null)
  })
})

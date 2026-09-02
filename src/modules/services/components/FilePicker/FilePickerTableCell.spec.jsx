import { render, screen } from '@testing-library/react'
import React from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { FilePickerTableCell } from './FilePickerTableCell'

import { ROOT_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('twake-i18n', () => ({
  useI18n: () => ({ t: key => key })
}))
jest.mock('@/modules/filelist/icons/FileThumbnail', () => () => null)
jest.mock('@/modules/filelist/useFormattedUpdatedAt', () => ({
  useFormattedUpdatedAt: () => 'January 2, 2025'
}))
jest.mock('@/modules/selection/SelectionProvider', () => ({
  useSelectionContext: () => ({ isItemSelected: () => false })
}))
jest.mock(
  '@/modules/filelist/virtualized/cells/columns/UpdatedAtCell',
  () => () => <span>updated-at-cell</span>
)
jest.mock('@/modules/filelist/virtualized/cells/columns/SizeCell', () => () => (
  <span>size-cell</span>
))

const file = {
  _id: 'file-id',
  type: 'file',
  name: 'report.pdf',
  path: '/Folder/report.pdf',
  dir_id: 'folder-id',
  size: 1000,
  updated_at: '2025-01-02T10:00:00.000Z'
}

function renderCell({
  row = file,
  isMobile = false,
  withFilePath = true
} = {}) {
  useBreakpoints.mockReturnValue({ isMobile })
  return render(
    <FilePickerTableCell
      column={{ id: 'name' }}
      row={row}
      selectionModeActive={false}
      withFilePath={withFilePath}
    />
  )
}

describe('FilePickerTableCell', () => {
  afterEach(() => jest.clearAllMocks())

  it('shows an informational parent path on desktop', () => {
    renderCell()

    expect(screen.getByText('/Folder')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBe(null)
  })

  it('shows the parent path instead of date and size metadata on mobile', () => {
    renderCell({ isMobile: true })

    expect(screen.getByText('/Folder')).toBeInTheDocument()
    expect(screen.queryByText(/January 2, 2025/)).toBe(null)
  })

  it('does not invent a path when the source has none', () => {
    renderCell({ row: { ...file, path: null } })

    expect(screen.queryByText('/Folder')).toBe(null)
  })

  it.each([
    [{ ...file, dir_id: ROOT_DIR_ID }, '/'],
    [{ ...file, dir_id: SHARED_DRIVES_DIR_ID }, '/sharings']
  ])('uses the existing parent path calculation', (row, path) => {
    renderCell({ row })

    expect(screen.getByText(path)).toBeInTheDocument()
  })

  it('keeps existing sections unchanged', () => {
    renderCell({ isMobile: false, withFilePath: false })

    expect(screen.queryByText('/Folder')).toBe(null)
    expect(screen.queryByText(/January 2, 2025/)).toBe(null)
  })

  it('keeps desktop date and size columns', () => {
    const { rerender } = render(
      <FilePickerTableCell column={{ id: 'updated_at' }} row={file} />
    )
    expect(screen.getByText('updated-at-cell')).toBeInTheDocument()

    rerender(<FilePickerTableCell column={{ id: 'size' }} row={file} />)
    expect(screen.getByText('size-cell')).toBeInTheDocument()
  })
})

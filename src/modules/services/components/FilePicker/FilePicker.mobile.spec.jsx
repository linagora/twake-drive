import { fireEvent, render, within } from '@testing-library/react'
import React from 'react'

import { Q, createMockClient } from 'cozy-client'

import FilePicker from './index'
import { buildContentFolderQuery } from './queries'
import AppLike from 'test/components/AppLike'

const mockRootId = 'io.cozy.files.root-dir'
const mockFolder = {
  _id: 'folder-id',
  id: 'folder-id',
  dir_id: mockRootId,
  type: 'directory',
  name: 'Photos'
}
const mockEmptyFile = {
  _id: 'empty-file-id',
  id: 'empty-file-id',
  dir_id: mockRootId,
  type: 'file',
  name: 'empty.txt',
  updated_at: '2025-01-02T10:00:00.000Z',
  size: 0
}
const mockFile = {
  _id: 'file-id',
  id: 'file-id',
  dir_id: mockRootId,
  type: 'file',
  name: 'report.pdf',
  updated_at: '2025-01-02T10:00:00.000Z',
  size: 1500
}
const mockItems = [mockFolder, mockEmptyFile, mockFile]
const mockClient = createMockClient({
  queries: {
    [`buildContentFolderQuery-${mockRootId}`]: {
      definition: buildContentFolderQuery(mockRootId).definition(),
      doctype: 'io.cozy.files',
      data: mockItems
    },
    'buildContentFolderQuery-folder-id': {
      definition: buildContentFolderQuery(mockFolder.id).definition(),
      doctype: 'io.cozy.files',
      data: mockItems
    },
    [`io.cozy.files/${mockRootId}`]: {
      definition: Q('io.cozy.files').getById(mockRootId),
      doctype: 'io.cozy.files',
      data: [
        {
          _id: mockRootId,
          id: mockRootId,
          dir_id: null,
          type: 'directory',
          name: 'My Drive'
        }
      ]
    },
    'io.cozy.files/folder-id': {
      definition: Q('io.cozy.files').getById(mockFolder.id),
      doctype: 'io.cozy.files',
      data: [mockFolder]
    }
  }
})

jest.mock('cozy-ui/transpiled/react/Table/Virtualized', () => {
  const React = require('react')
  const VirtualizedTable = React.forwardRef(
    (
      { rows, columns, context, components, componentsProps, isSelectedItem },
      ref
    ) => {
      const TableHead = components.TableHead
      const TableRow = components.TableRow

      return (
        <table ref={ref}>
          <TableHead>
            <tr>
              {columns.map(column => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </TableHead>
          <tbody>
            {rows.map(row => (
              <TableRow
                key={row._id}
                item={row}
                context={{ ...context, isSelectedItem }}
              >
                {columns.map(column => (
                  <td key={column.id}>
                    {React.cloneElement(componentsProps.rowContent.children, {
                      column,
                      row
                    })}
                  </td>
                ))}
              </TableRow>
            ))}
          </tbody>
        </table>
      )
    }
  )
  VirtualizedTable.displayName = 'VirtualizedTable'

  return { __esModule: true, default: VirtualizedTable }
})

const mockOnChange = jest.fn()
const mockOnFileDoubleClick = jest.fn()

function getVisibleText(element) {
  return element.textContent.replaceAll('\u200e', '')
}

function setup({ isMobile = true } = {}) {
  window.innerWidth = isMobile ? 500 : 1024

  return render(
    <AppLike client={mockClient}>
      <FilePicker
        onChange={mockOnChange}
        onFileDoubleClick={mockOnFileDoubleClick}
      />
    </AppLike>
  )
}

describe('FilePicker mobile navigation and list', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('preserves desktop columns, selection and folder double-click navigation', () => {
    const { getAllByTestId, getByTestId, queryByRole } = setup({
      isMobile: false
    })
    const rows = getAllByTestId('list-item')
    const folderRow = rows.find(row => row.dataset.fileId === mockFolder.id)
    const fileRow = rows.find(row => row.dataset.fileId === mockFile.id)

    expect(queryByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(
      queryByRole('columnheader', { name: 'Last update' })
    ).toBeInTheDocument()
    expect(queryByRole('columnheader', { name: 'Size' })).toBeInTheDocument()
    fireEvent.click(fileRow)
    expect(getByTestId('public-link-btn')).not.toBeDisabled()

    fireEvent.doubleClick(folderRow)
    expect(getByTestId('file-picker-breadcrumb')).toHaveTextContent('My Drive')
    expect(getByTestId('file-picker-breadcrumb')).toHaveTextContent('Photos')
    expect(queryByRole('button', { name: 'Back' })).toBe(null)
  })

  it('leaves files unselected and gives double taps no extra behavior', () => {
    const { getAllByTestId, getByTestId } = setup()
    const rows = getAllByTestId('list-item')
    const folderRow = rows.find(row => row.dataset.fileId === mockFolder.id)
    const fileRow = rows.find(row => row.dataset.fileId === mockFile.id)

    fireEvent.click(fileRow)
    fireEvent.click(fileRow)
    fireEvent.doubleClick(fileRow)

    expect(getByTestId('public-link-btn')).toBeDisabled()
    expect(getByTestId('file-picker-breadcrumb')).toHaveTextContent('My Drive')

    fireEvent.click(folderRow)

    expect(getByTestId('file-picker-breadcrumb')).toHaveTextContent('Photos')
    expect(mockOnFileDoubleClick).not.toHaveBeenCalled()
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('renders compact rows without column headers', () => {
    const { getAllByTestId, queryAllByRole } = setup()
    const folderRow = getAllByTestId('list-item').find(
      row => row.dataset.fileId === mockFolder.id
    )
    const emptyFileRow = getAllByTestId('list-item').find(
      row => row.dataset.fileId === mockEmptyFile.id
    )
    const fileRow = getAllByTestId('list-item').find(
      row => row.dataset.fileId === mockFile.id
    )

    expect(queryAllByRole('columnheader')).toHaveLength(0)
    expect(getVisibleText(folderRow)).toContain('Photos')
    expect(folderRow).not.toHaveTextContent('Jan 2, 2025')
    expect(folderRow).not.toHaveTextContent('1.5 kB')
    expect(getVisibleText(fileRow)).toContain('report.pdf')
    expect(
      within(fileRow).getByText('Jan 2, 2025 - 1.5 kB')
    ).toBeInTheDocument()
    expect(
      within(emptyFileRow).getByText('Jan 2, 2025 - 0 B')
    ).toBeInTheDocument()
  })

  it('opens a folder on tap and shows only its name with a back control', () => {
    const { getByTestId, getByRole, getAllByTestId, queryByRole } = setup()
    const folderRow = getAllByTestId('list-item').find(
      row => row.dataset.fileId === mockFolder.id
    )

    fireEvent.click(folderRow)

    expect(getByTestId('file-picker-breadcrumb')).toHaveTextContent('Photos')
    expect(getByTestId('file-picker-breadcrumb')).not.toHaveTextContent(
      'My Drive'
    )

    fireEvent.click(getByRole('button', { name: 'Back' }))

    expect(getByTestId('file-picker-breadcrumb')).toHaveTextContent('My Drive')
    expect(queryByRole('button', { name: 'Back' })).toBe(null)
  })
})

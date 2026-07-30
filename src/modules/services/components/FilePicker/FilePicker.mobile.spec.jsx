import { render, within } from '@testing-library/react'
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

function setup() {
  window.innerWidth = 500

  return render(
    <AppLike client={mockClient}>
      <FilePicker
        onChange={mockOnChange}
        onFileDoubleClick={mockOnFileDoubleClick}
      />
    </AppLike>
  )
}

describe('FilePicker mobile list', () => {
  afterEach(() => {
    jest.clearAllMocks()
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
})

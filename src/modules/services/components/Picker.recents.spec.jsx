import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { Q, createMockClient } from 'cozy-client'
import { useDataProxy } from 'cozy-dataproxy-lib'

import IntentHandler from './IntentHandler'
import { IntentLike } from 'test/components/IntentLike'

import { buildContentFolderQuery } from '@/components/FilePicker/queries'

const mockCreateService = jest.fn()
const mockGetIntent = jest.fn()

jest.mock('cozy-interapp', () =>
  jest.fn().mockImplementation(() => ({
    createService: mockCreateService,
    request: { get: mockGetIntent }
  }))
)

jest.mock('cozy-dataproxy-lib', () => ({
  DataProxyProvider: ({ children }) => children,
  useDataProxy: jest.fn()
}))

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

const rootId = 'io.cozy.files.root-dir'
const recentFile = {
  _id: 'recent-shared-id',
  id: 'recent-shared-id',
  type: 'file',
  name: 'shared-report.pdf',
  path: '/Shared/shared-report.pdf',
  dir_id: 'shared-folder-id',
  driveId: 'drive-id',
  mime: 'application/pdf',
  size: 42,
  updated_at: '2025-01-02T10:00:00.000Z'
}

function makeClient() {
  const contentQuery = buildContentFolderQuery(rootId)
  return createMockClient({
    queries: {
      [contentQuery.options.as]: {
        definition: contentQuery.definition(),
        doctype: 'io.cozy.files',
        data: []
      },
      [`io.cozy.files/${rootId}`]: {
        definition: Q('io.cozy.files').getById(rootId),
        doctype: 'io.cozy.files',
        data: [
          {
            _id: rootId,
            id: rootId,
            dir_id: null,
            type: 'directory',
            name: 'My Drive'
          }
        ]
      }
    }
  })
}

describe('Picker Recents integration', () => {
  afterEach(() => jest.clearAllMocks())

  it('fetches federated shared folder files from dataproxy and revalidates on pick', async () => {
    window.innerWidth = 1024
    const mockRecents = jest.fn().mockResolvedValue([recentFile])
    useDataProxy.mockReturnValue({
      dataProxyServicesAvailable: true,
      recents: mockRecents
    })
    const client = makeClient()
    const intent = { attributes: { action: 'PICK', type: 'io.cozy.files' } }
    const service = {
      getIntent: () => intent,
      getData: () => ({}),
      cancel: jest.fn(),
      terminate: jest.fn(),
      throw: jest.fn(),
      notifyReadyToUse: jest.fn()
    }
    mockGetIntent.mockResolvedValue(intent)
    mockCreateService.mockResolvedValue(service)

    render(
      <IntentLike client={client}>
        <IntentHandler intentId="intent-id" />
      </IntentLike>
    )

    fireEvent.click(await screen.findByRole('tab', { name: /Recents/i }))
    expect(await screen.findByTestId('list-item')).toHaveAttribute(
      'data-file-id',
      recentFile._id
    )
    await waitFor(() => expect(mockRecents).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('tab', { name: /My Drive/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Recents/i }))
    const row = await screen.findByTestId('list-item')
    await waitFor(() => expect(mockRecents).toHaveBeenCalledTimes(2))

    const query = jest.spyOn(client, 'query').mockResolvedValue({
      data: { ...recentFile }
    })
    const getDownloadLinkById = jest
      .fn()
      .mockResolvedValue('https://download.example/shared-report.pdf')
    const collection = jest
      .spyOn(client, 'collection')
      .mockReturnValue({ getDownloadLinkById })

    fireEvent.click(row)
    fireEvent.click(screen.getByTestId('temporary-download-link-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalledTimes(1))
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        doctype: 'io.cozy.files',
        id: recentFile._id,
        sharingId: recentFile.driveId
      }),
      expect.objectContaining({
        as: `io.cozy.files/${recentFile.driveId}/${recentFile._id}`
      })
    )
    expect(collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: recentFile.driveId
    })
    expect(getDownloadLinkById).toHaveBeenCalledWith(
      recentFile._id,
      recentFile.name
    )
    expect(service.terminate).toHaveBeenCalledWith([
      expect.objectContaining({
        id: recentFile._id,
        name: recentFile.name,
        downloadLink: 'https://download.example/shared-report.pdf'
      })
    ])
  })
})

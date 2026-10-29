import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePickerBody } from './FilePickerBody'
import {
  filePickerItemTypes,
  filePickerModes,
  filePickerSections
} from './constants'

import { useBreadcrumbPath } from '@/modules/breadcrumb/hooks/useBreadcrumbPath'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
let mockRealtimeCallback

jest.mock('lodash/debounce', () =>
  jest.fn(fn => {
    fn.cancel = jest.fn()
    return fn
  })
)
jest.mock('cozy-realtime', () =>
  jest.fn().mockImplementation(() => ({
    subscribe: jest.fn((_event, _doctype, callback) => {
      mockRealtimeCallback = callback
    }),
    on: jest.fn(),
    removeListener: jest.fn(),
    stop: jest.fn()
  }))
)
jest.mock('twake-i18n', () => ({
  useI18n: jest.fn(),
  translate: () => Component => Component,
  withOnlyLocales: () => Component => Component
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('@/modules/breadcrumb/hooks/useBreadcrumbPath', () => ({
  useBreadcrumbPath: jest.fn()
}))
jest.mock('@/modules/filelist/icons/FileThumbnail', () => () => null)
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() }
}))
jest.mock('cozy-ui/transpiled/react/Table/Virtualized', () => {
  const React = require('react')
  const Virtualized = React.forwardRef(
    (
      {
        rows,
        columns,
        context,
        components,
        componentsProps,
        isSelectedItem,
        endReached
      },
      ref
    ) => {
      const Row = components.TableRow
      return (
        <>
          <table ref={ref}>
            <tbody>
              {rows.map(row => (
                <Row
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
                </Row>
              ))}
            </tbody>
          </table>
          {endReached && (
            <button type="button" onClick={endReached}>
              More
            </button>
          )}
        </>
      )
    }
  )
  Virtualized.displayName = 'Virtualized'
  return { __esModule: true, default: Virtualized }
})

function makeItem(id, type, name) {
  return {
    _id: id,
    id,
    _type: 'io.cozy.files',
    type,
    name,
    dir_id: 'folder-id',
    path: `/Folder/${name}`,
    updated_at: '2025-01-01T00:00:00.000Z',
    size: 10
  }
}

beforeEach(() => {
  useSharingContext.mockReturnValue({
    allLoaded: true,
    byDocId: {},
    isOwner: () => false
  })
  useBreakpoints.mockReturnValue({ isMobile: false })
  useI18n.mockReturnValue({ t: key => key, f: () => 'date' })
  useBreadcrumbPath.mockReturnValue([{ id: 'folder-id', name: 'Folder' }])
})

it('sorts each shared-drive page progressively with folders first', async () => {
  const folder2 = makeItem('folder-2', 'directory', 'Folder 2')
  const folder1 = makeItem('folder-1', 'directory', 'Folder 1')
  const file1 = makeItem('file-1', 'file', 'file-1.txt')
  const file2 = makeItem('file-2', 'file', 'file-2.txt')
  const statById = jest
    .fn()
    .mockResolvedValueOnce({
      included: [folder1],
      links: { next: '/files?page[cursor]=two' }
    })
    .mockResolvedValueOnce({
      included: [folder2, file1],
      links: { next: '/files?page[cursor]=three' }
    })
    .mockResolvedValueOnce({ included: [file2], links: {} })
  const collection = jest.fn(() => ({ statById }))
  useClient.mockReturnValue({ collection })
  render(
    <FilePickerBody
      mode={filePickerModes.CURRENT_FOLDER}
      section={filePickerSections.DRIVE}
      folderId="folder-id"
      driveId="drive-id"
      navigateTo={() => {}}
      displayedTypes={[filePickerItemTypes.FOLDER, filePickerItemTypes.FILE]}
      selectableTypes={[]}
      isItemDisabled={item => item.type === 'file'}
      sortOrder={{ attribute: 'name', order: 'desc' }}
    />
  )
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')).toHaveLength(1)
  )
  expect(screen.getByTestId('list-item')).toHaveAttribute(
    'data-file-id',
    'folder-1'
  )
  expect(statById).toHaveBeenCalledTimes(1)
  expect(collection).toHaveBeenCalledWith('io.cozy.files', {
    driveId: 'drive-id'
  })
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')).toHaveLength(3)
  )
  expect(
    screen
      .getAllByTestId('list-item')
      .map(row => row.getAttribute('data-file-id'))
  ).toEqual(['folder-2', 'folder-1', 'file-1'])
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')).toHaveLength(4)
  )
  const rows = screen.getAllByTestId('list-item')
  expect(rows.map(row => row.getAttribute('data-file-id'))).toEqual([
    'folder-2',
    'folder-1',
    'file-2',
    'file-1'
  ])
  expect(rows[2]).toHaveAttribute('aria-disabled', 'true')
  expect(rows[3]).toHaveAttribute('aria-disabled', 'true')
})

it('continues to the next page if all folders are filtered out', async () => {
  const hidden = makeItem('hidden', 'directory', 'Hidden')
  const file = makeItem('file-1', 'file', 'file-1.txt')
  const statById = jest
    .fn()
    .mockResolvedValueOnce({
      included: [hidden],
      links: { next: '/files?page[cursor]=next' }
    })
    .mockResolvedValueOnce({ included: [file], links: {} })
  useClient.mockReturnValue({ collection: () => ({ statById }) })
  render(
    <FilePickerBody
      mode={filePickerModes.CURRENT_FOLDER}
      section={filePickerSections.DRIVE}
      folderId="folder-id"
      driveId="drive-id"
      navigateTo={() => {}}
      displayedTypes={[filePickerItemTypes.FOLDER, filePickerItemTypes.FILE]}
      selectableTypes={[]}
      isItemIncluded={item => item._id !== 'hidden'}
      isItemDisabled={item => item.type === 'file'}
    />
  )
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')).toHaveLength(1)
  )
  expect(screen.getByTestId('list-item')).toHaveAttribute(
    'data-file-id',
    'file-1'
  )
  expect(screen.getByTestId('list-item')).toHaveAttribute(
    'aria-disabled',
    'true'
  )
})

it('recovers when a successful realtime refresh supersedes an automatic file load', async () => {
  const hidden = makeItem('hidden', 'directory', 'Hidden')
  const file2 = makeItem('file-2', 'file', 'file-2.txt')
  let resolveOldPage
  const oldPage = new Promise(resolve => {
    resolveOldPage = resolve
  })
  const firstPage = {
    included: [hidden],
    links: { next: '/files?page[cursor]=two' }
  }
  const statById = jest
    .fn()
    .mockResolvedValueOnce(firstPage)
    .mockReturnValueOnce(oldPage)
    .mockResolvedValueOnce(firstPage)
    .mockResolvedValueOnce({ included: [file2], links: {} })
  useClient.mockReturnValue({ collection: () => ({ statById }) })
  render(
    <FilePickerBody
      mode={filePickerModes.CURRENT_FOLDER}
      section={filePickerSections.DRIVE}
      folderId="folder-id"
      driveId="drive-id"
      navigateTo={() => {}}
      displayedTypes={[filePickerItemTypes.FOLDER, filePickerItemTypes.FILE]}
      selectableTypes={[]}
      isItemIncluded={item => item._id !== 'hidden'}
      isItemDisabled={item => item.type === 'file'}
    />
  )
  await waitFor(() => expect(statById).toHaveBeenCalledTimes(2))
  await act(async () => mockRealtimeCallback())
  await waitFor(() => expect(statById).toHaveBeenCalledTimes(3))
  await act(async () =>
    resolveOldPage({
      included: [file2],
      links: { next: '/files?page[cursor]=old-three' }
    })
  )
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')).toHaveLength(1)
  )
  expect(screen.queryByTestId('file-picker-source-error')).toBe(null)
  expect(
    screen
      .getAllByTestId('list-item')
      .map(row => row.getAttribute('data-file-id'))
  ).toEqual(['file-2'])
  expect(statById).toHaveBeenCalledTimes(4)
})

it('reports a file page failure when folders are visible', async () => {
  const folder = makeItem('folder', 'directory', 'Folder')
  const file = makeItem('file-1', 'file', 'file-1.txt')
  const statById = jest
    .fn()
    .mockResolvedValueOnce({
      included: [folder, file],
      links: { next: '/files?page[cursor]=next' }
    })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      included: [folder, file],
      links: { next: '/files?page[cursor]=next' }
    })
  useClient.mockReturnValue({ collection: () => ({ statById }) })
  render(
    <FilePickerBody
      mode={filePickerModes.CURRENT_FOLDER}
      section={filePickerSections.DRIVE}
      folderId="folder-id"
      driveId="drive-id"
      navigateTo={() => {}}
      displayedTypes={[filePickerItemTypes.FOLDER, filePickerItemTypes.FILE]}
      selectableTypes={[]}
      isItemDisabled={item => item.type === 'file'}
    />
  )
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')[0]).toHaveAttribute(
      'data-file-id',
      'folder'
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  expect(
    await screen.findByTestId('file-picker-source-error')
  ).toBeInTheDocument()
  await act(async () => mockRealtimeCallback())
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')[0]).toHaveAttribute(
      'data-file-id',
      'folder'
    )
  )
  expect(screen.queryByTestId('file-picker-source-error')).toBe(null)
})

it('keeps numeric name sorting when only files span multiple pages', async () => {
  const ten = makeItem('ten', 'file', '10.txt')
  const two = makeItem('two', 'file', '2.txt')
  const statById = jest
    .fn()
    .mockResolvedValueOnce({
      included: [ten],
      links: { next: '/files?page[cursor]=next' }
    })
    .mockResolvedValueOnce({ included: [two], links: {} })
  useClient.mockReturnValue({ collection: () => ({ statById }) })
  render(
    <FilePickerBody
      mode={filePickerModes.CURRENT_FOLDER}
      section={filePickerSections.DRIVE}
      folderId="folder-id"
      driveId="drive-id"
      navigateTo={() => {}}
      displayedTypes={[filePickerItemTypes.FOLDER, filePickerItemTypes.FILE]}
      selectableTypes={[]}
      isItemDisabled={item => item.type === 'file'}
      sortOrder={{ attribute: 'name', order: 'asc' }}
    />
  )
  await waitFor(() =>
    expect(screen.getByTestId('list-item')).toHaveAttribute(
      'data-file-id',
      'ten'
    )
  )
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  await waitFor(() =>
    expect(screen.getAllByTestId('list-item')).toHaveLength(2)
  )
  expect(
    screen
      .getAllByTestId('list-item')
      .map(row => row.getAttribute('data-file-id'))
  ).toEqual(['two', 'ten'])
})

it('shows an error if loading files after filtered folders fails', async () => {
  const hidden = makeItem('hidden', 'directory', 'Hidden')
  const statById = jest
    .fn()
    .mockResolvedValueOnce({
      included: [hidden],
      links: { next: '/files?page[cursor]=next' }
    })
    .mockRejectedValueOnce(new Error('offline'))
  useClient.mockReturnValue({ collection: () => ({ statById }) })
  render(
    <FilePickerBody
      mode={filePickerModes.CURRENT_FOLDER}
      section={filePickerSections.DRIVE}
      folderId="folder-id"
      driveId="drive-id"
      navigateTo={() => {}}
      displayedTypes={[filePickerItemTypes.FOLDER, filePickerItemTypes.FILE]}
      selectableTypes={[]}
      isItemIncluded={item => item._id !== 'hidden'}
      isItemDisabled={item => item.type === 'file'}
    />
  )
  expect(
    await screen.findByTestId('file-picker-source-error')
  ).toBeInTheDocument()
  expect(screen.queryByTestId('list-item')).toBe(null)
  expect(statById).toHaveBeenCalledTimes(2)
})

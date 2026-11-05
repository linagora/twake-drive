import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'

import { createMockClient } from 'cozy-client'

import { TrashFolderView } from './TrashFolderView'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(() => null)
}))

import { useCurrentFolderId, useDisplayedFolder, useFolderSort } from '@/hooks'
import en from '@/locales/en.json'

jest.mock('@/hooks', () => ({
  useCurrentFolderId: jest.fn(() => 'io.cozy.files.trash-dir'),
  useDisplayedFolder: jest.fn(() => ({
    displayedFolder: { _id: 'trash' },
    isNotFound: false
  })),
  useFolderSort: jest.fn(() => [
    { attribute: 'updated_at', order: 'desc' },
    jest.fn()
  ])
}))

jest.mock('@/components/useHead', () => jest.fn())
const mockFolderViewBody = ({ actions }) => (
  <div data-testid="trash-content">
    {actions.map(action => Object.keys(action)[0]).join(',')}
  </div>
)
jest.mock('../Folder/FolderViewBody', () => props => mockFolderViewBody(props))
jest.mock(
  '../Folder/virtualized/FolderViewBody',
  () => props => mockFolderViewBody(props)
)
jest.mock('@/modules/trash/components/TrashBreadcrumb', () => ({
  TrashBreadcrumb: () => null
}))
jest.mock('@/modules/trash/components/TrashToolbar', () => ({
  TrashToolbar: () => <div data-testid="trash-toolbar" />
}))
jest.mock('@/modules/filelist/FileListRowsPlaceholder', () => () => (
  <div data-testid="trash-loading" />
))

const client = createMockClient({})
client.query = jest.fn().mockReturnValue({ data: [] })

function TestComponent({ onResult }) {
  const currentFolderId = useCurrentFolderId()
  const [sortOrder] = useFolderSort(currentFolderId)

  React.useEffect(() => {
    onResult({ currentFolderId, sortOrder })
  }, [currentFolderId, sortOrder, onResult])

  return null
}

describe('TrashFolderView', () => {
  it('uses the updated_at sort for trash folder by default', () => {
    let result = null

    const handleResult = data => {
      result = data
    }

    render(
      <AppLike client={client}>
        <TestComponent onResult={handleResult} />
      </AppLike>
    )

    expect(result.currentFolderId).toBe('io.cozy.files.trash-dir')
    expect(result.sortOrder.attribute).toBe('updated_at')
    expect(result.sortOrder.order).toBe('desc')
  })
})

describe('TrashFolderView redirection', () => {
  const getFileQueries = client =>
    client.query.mock.calls.filter(
      ([query]) => query.doctype === 'io.cozy.files'
    )

  afterEach(() => {
    window.location.hash = ''
  })

  const setup = async (
    displayedFolder,
    {
      folderId = displayedFolder?.id ?? 'pending-id',
      childPath = '',
      isLoading = false,
      isNotFound = false
    } = {}
  ) => {
    useCurrentFolderId.mockReturnValue(folderId)
    useDisplayedFolder.mockReturnValue({
      displayedFolder,
      isNotFound,
      isLoading
    })
    window.location.hash = `#/trash/${folderId}${childPath}`
    const { store, client } = setupStoreAndClient()
    client.plugins.realtime = { subscribe: jest.fn(), unsubscribe: jest.fn() }
    client.query = jest.fn().mockReturnValue({ data: [] })
    await act(async () => {
      render(
        <AppLike client={client} store={store}>
          <Routes>
            <Route path="trash/:folderId/*" element={<TrashFolderView />} />
            <Route path="folder/:folderId/*" element={null} />
          </Routes>
        </AppLike>
      )
    })
    return client
  }

  it.each(['/Projects', '/.cozy_trash_backup'])(
    'opens the live folder %s in the drive instead',
    async path => {
      const client = await setup({ id: 'live-id', path })

      expect(window.location.hash).toBe('#/folder/live-id')
      expect(screen.queryByTestId('trash-content')).toBe(null)
      expect(getFileQueries(client)).toHaveLength(0)
    }
  )

  it.each(['/.cozy_trash', '/.cozy_trash/Projects'])(
    'keeps %s in the trash with its trash actions',
    async path => {
      const client = await setup({ id: 'trashed-id', path })

      expect(window.location.hash).toBe('#/trash/trashed-id')
      expect(screen.getByTestId('trash-content')).toHaveTextContent('destroy')
      expect(getFileQueries(client)).toHaveLength(2)
    }
  )

  it.each(['/file/file-id', '/file/file-id/revision'])(
    'preserves the child route %s and query parameters',
    async childPath => {
      await setup(
        { id: 'live-id', path: '/Projects' },
        { childPath: `${childPath}?test=value` }
      )

      expect(window.location.hash).toBe(
        `#/folder/live-id${childPath}?test=value`
      )
    }
  )

  it.each(['/destroy', '/empty'])(
    'drops the Bin-only route %s when redirecting',
    async childPath => {
      await setup({ id: 'live-id', path: '/Projects' }, { childPath })

      expect(window.location.hash).toBe('#/folder/live-id')
    }
  )

  it('waits for the folder before fetching or showing its Bin content', async () => {
    const client = await setup(null, { isLoading: true })

    expect(screen.getByTestId('trash-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('trash-content')).toBe(null)
    expect(screen.queryByTestId('trash-toolbar')).toBe(null)
    expect(getFileQueries(client)).toHaveLength(0)
  })

  it('shows an error when the folder lookup fails without a 404', async () => {
    const client = await setup(null)

    expect(screen.getByText(en.error.open_folder)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: en.error.button.reload })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('trash-content')).toBe(null)
    expect(screen.queryByTestId('trash-toolbar')).toBe(null)
    expect(getFileQueries(client)).toHaveLength(0)
  })

  it('keeps the not-found page for a missing folder', async () => {
    await setup(null, { isNotFound: true })

    expect(screen.getByText(en.NotFound.title)).toBeInTheDocument()
    expect(screen.queryByText(en.error.open_folder)).toBe(null)
    expect(screen.queryByTestId('trash-content')).toBe(null)
  })
})

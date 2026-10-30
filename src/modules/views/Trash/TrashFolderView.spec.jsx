import { act, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import { TrashFolderView } from './TrashFolderView'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(() => null)
}))

import { useCurrentFolderId, useDisplayedFolder, useFolderSort } from '@/hooks'

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
  TrashToolbar: () => null
}))

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
  const setup = async (displayedFolder, folderId = displayedFolder.id) => {
    useDisplayedFolder.mockReturnValue({ displayedFolder, isNotFound: false })
    window.location.hash = `#/trash/${folderId}`
    const { store, client } = setupStoreAndClient()
    client.plugins.realtime = { subscribe: jest.fn(), unsubscribe: jest.fn() }
    client.query = jest.fn().mockReturnValue({ data: [] })
    await act(async () => {
      render(
        <AppLike client={client} store={store}>
          <TrashFolderView />
        </AppLike>
      )
    })
  }

  it.each(['/Projects', '/.cozy_trash_backup'])(
    'opens the live folder %s in the drive instead',
    async path => {
      await setup({ id: 'live-id', path })

      expect(window.location.hash).toBe('#/folder/live-id')
      expect(screen.queryByTestId('trash-content')).toBe(null)
    }
  )

  it.each(['/.cozy_trash', '/.cozy_trash/Projects'])(
    'keeps %s in the trash with its trash actions',
    async path => {
      await setup({ id: 'trashed-id', path })

      expect(window.location.hash).toBe('#/trash/trashed-id')
      expect(screen.getByTestId('trash-content')).toHaveTextContent('destroy')
    }
  )

  it('offers no trash action while the folder is not known to be trashed', async () => {
    await setup(null, 'pending-id')

    expect(screen.getByTestId('trash-content')).toBeEmptyDOMElement()
  })
})

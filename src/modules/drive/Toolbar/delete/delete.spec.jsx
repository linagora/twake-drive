import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { EnhancedDeleteConfirm } from './delete'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

const mockNavigate = jest.fn()

jest.mock('lib/logger', () => ({
  error: jest.fn()
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

jest.mock('@/lib/ViewSwitcherContext', () => ({
  ViewSwitcherContextProvider: ({ children }) => children,
  useViewSwitcherContext: jest.fn(() => ({
    viewType: 'list',
    switchView: jest.fn()
  }))
}))

describe('EnhancedDeleteConfirm', () => {
  const setup = () => {
    const folder = {
      _id: 'folder-id',
      name: 'My folder',
      dir_id: 'parent-folder-id'
    }
    const { client, store } = setupStoreAndClient({})
    const mockSharingContext = {
      hasWriteAccess: () => true,
      getRecipients: () => [],
      getSharingLink: () => null
    }
    const container = render(
      <AppLike
        client={client}
        store={store}
        sharingContextValue={mockSharingContext}
      >
        <EnhancedDeleteConfirm folder={folder} onClose={() => null} />
      </AppLike>
    )
    return { container, folder, client }
  }

  it('should trashFiles on confirmation', async () => {
    const { container } = setup()
    const confirmButton = container.getByText('Remove')
    fireEvent.click(confirmButton)
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/folder/parent-folder-id')
    )
  })
})

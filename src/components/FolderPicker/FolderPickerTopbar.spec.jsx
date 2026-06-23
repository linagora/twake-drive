import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { FolderPickerTopbar } from '@/components/FolderPicker/FolderPickerTopbar'

jest.mock('@/modules/nextcloud/hooks/useNextcloudInfos', () => ({
  useNextcloudInfos: () => ({
    isLoading: false,
    instanceName: 'Cozycloud',
    instanceUrl: 'https://cozycloud.example.com',
    rootFolderName: 'Cozycloud (Nextcloud)'
  })
}))

describe('FolderPickerTopbar', () => {
  const navigateTo = jest.fn()
  const showFolderCreation = jest.fn()

  const cozyFolder = {
    _id: '123',
    _type: 'io.cozy.files',
    type: 'directory',
    dir_id: 'io.cozy.files.root-dir',
    name: 'Photos'
  }

  const rootCozyFolder = {
    id: 'io.cozy.files.root-dir',
    _id: 'io.cozy.files.root-dir',
    _type: 'io.cozy.files',
    type: 'directory'
  }

  const sharedDrivesFolder = {
    id: 'io.cozy.files.shared-drives-dir',
    _id: 'io.cozy.files.shared-drives-dir',
    _type: 'io.cozy.files',
    type: 'directory',
    dir_id: 'io.cozy.files.root-dir'
  }

  const nextcloudFolder = {
    id: '123',
    _id: '123',
    _type: 'io.cozy.remote.nextcloud.files',
    path: '/Documents',
    parentPath: '/',
    name: 'Documents',
    cozyMetadata: {
      sourceAccount: '123'
    },
    links: {
      self: 'unknown'
    },
    size: 0,
    type: 'directory',
    updated_at: expect.any(String)
  }

  const rootNextcloudFolder = {
    id: 'io.cozy.remote.nextcloud.files.root-dir',
    _id: 'io.cozy.remote.nextcloud.files.root-dir',
    _type: 'io.cozy.remote.nextcloud.files',
    path: '/',
    parentPath: '',
    name: 'Cozycloud (Nextcloud)',
    cozyMetadata: {
      sourceAccount: '123'
    },
    links: {
      self: 'unknown'
    },
    size: 0,
    type: 'directory',
    updated_at: expect.any(String)
  }

  const setup = ({
    canCreateFolder = false,
    folder,
    showFolderCreation: showFolderCreationProp
  } = {}) => {
    const mockClient = createMockClient({
      queries: {
        'io.cozy.files/io.cozy.files.root-dir': {
          doctype: 'io.cozy.files',
          definition: {
            doctype: 'io.cozy.files',
            id: 'io.cozy.files.root-dir'
          },
          data: [rootCozyFolder]
        },
        'io.cozy.files/io.cozy.files.shared-drives-dir': {
          doctype: 'io.cozy.files',
          definition: {
            doctype: 'io.cozy.files',
            id: 'io.cozy.files.shared-drives-dir'
          },
          data: [sharedDrivesFolder]
        },
        'io.cozy.remote.nextcloud.files/sourceAccount/123/path/': {
          doctype: 'io.cozy.remote.nextcloud.files',
          data: [nextcloudFolder]
        }
      }
    })

    return render(
      <AppLike client={mockClient}>
        <FolderPickerTopbar
          navigateTo={navigateTo}
          folder={folder}
          canCreateFolder={canCreateFolder}
          showFolderCreation={showFolderCreationProp}
        />
      </AppLike>
    )
  }

  it('should hide back button for the root cozy folder', () => {
    setup({ folder: rootCozyFolder })

    expect(screen.getByText('Files')).toBeInTheDocument()

    const backButton = screen.queryByRole('button', {
      name: 'Back'
    })
    expect(backButton).toBeNull()
  })

  it('should show back button for a cozy folder', async () => {
    setup({ folder: cozyFolder })

    expect(screen.getByText('Photos')).toBeInTheDocument()

    const backButton = screen.getByRole('button', {
      name: 'Back'
    })
    fireEvent.click(backButton)
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(rootCozyFolder)
    })
  })

  it('should show back button for a nextcloud folder', async () => {
    setup({ folder: nextcloudFolder })

    expect(screen.getByText('Documents')).toBeInTheDocument()

    const backButton = screen.getByRole('button', {
      name: 'Back'
    })
    fireEvent.click(backButton)
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(rootNextcloudFolder)
    })
  })

  it('should show back button inside a deep nextcloud folder', async () => {
    setup({
      folder: {
        _id: '123',
        _type: 'io.cozy.remote.nextcloud.files',
        path: '/Documents/Invoices',
        parentPath: '/Documents',
        name: 'Invoices',
        cozyMetadata: {
          sourceAccount: '123'
        }
      }
    })

    expect(screen.getByText('Invoices')).toBeInTheDocument()

    const backButton = screen.getByRole('button', {
      name: 'Back'
    })
    fireEvent.click(backButton)
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: '123',
          _type: 'io.cozy.remote.nextcloud.files',
          path: '/Documents',
          parentPath: '/',
          name: 'Documents',
          cozyMetadata: {
            sourceAccount: '123'
          },
          id: '123'
        })
      )
    })
  })

  it('should show back button for a root nextcloud folder', async () => {
    setup({ folder: rootNextcloudFolder })

    expect(screen.getByText('Cozycloud (Nextcloud)')).toBeInTheDocument()

    const backButton = screen.getByRole('button', {
      name: 'Back'
    })
    fireEvent.click(backButton)
    await waitFor(() => {
      expect(navigateTo).toHaveBeenCalledWith(sharedDrivesFolder)
    })
  })

  it('should show create folder button when canCreateFolder and inside cozy folder', async () => {
    setup({ canCreateFolder: true, folder: cozyFolder, showFolderCreation })

    const addFolderButton = screen.getByRole('button', {
      name: 'Add a folder'
    })
    fireEvent.click(addFolderButton)
    await waitFor(() => {
      expect(showFolderCreation).toHaveBeenCalled()
    })
  })

  it('should hide create folder button when canCreateFolder is false', () => {
    setup({ canCreateFolder: false, folder: cozyFolder })

    const addFolderButton = screen.queryByRole('button', {
      name: 'Add a folder'
    })
    expect(addFolderButton).toBeNull()
  })

  it('should hide create folder button when canCreateFolder is true but its inside Nextcloud folder', () => {
    setup({
      canCreateFolder: true,
      folder: nextcloudFolder
    })

    const addFolderButton = screen.queryByRole('button', {
      name: 'Add a folder'
    })
    expect(addFolderButton).toBeNull()
  })
})

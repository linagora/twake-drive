import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import AppLike from 'test/components/AppLike'

import { FolderPicker } from '@/components/FolderPicker/FolderPicker'

jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))

jest.mock('cozy-sharing', () => ({
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn(),
  SharingCollection: {
    data: jest.fn().mockResolvedValue({ data: [] })
  }
}))

useSharingContext.mockReturnValue({ byDocId: [] })

jest.mock('@/components/FolderPicker/FolderPickerBody', () => ({
  FolderPickerBody: jest
    .fn()
    .mockImplementation(({ isFolderCreationDisplayed }) => (
      <div data-testid="folder-picker-body">
        <div>Mocked Folder Picker Body</div>
        {isFolderCreationDisplayed && (
          <div data-testid="name-input">
            <input placeholder="Folder name" />
          </div>
        )}
      </div>
    ))
}))

describe('FolderPicker', () => {
  const cozyFile = {
    id: 'file123',
    _id: 'file123',
    _type: 'io.cozy.files',
    dir_id: 'folder123',
    name: 'penguins.jpg'
  }

  const cozyFolder = {
    id: 'folder123',
    _id: 'folder123',
    _type: 'io.cozy.files',
    dir_id: 'io.cozy.files.root-dir',
    name: 'Photos'
  }

  const rootCozyFolder = {
    id: 'io.cozy.files.root-dir',
    _id: 'io.cozy.files.root-dir',
    _type: 'io.cozy.files'
  }

  const onCloseSpy = jest.fn()
  const onConfirmSpy = jest.fn()

  const setup = () => {
    const mockClient = createMockClient({
      queries: {
        'io.cozy.files/io.cozy.files.root-dir': {
          doctype: 'io.cozy.files',
          definition: {
            doctype: 'io.cozy.files',
            id: 'io.cozy.files.root-dir'
          },
          data: [rootCozyFolder]
        }
      }
    })

    return render(
      <AppLike client={mockClient}>
        <FolderPicker
          currentFolder={cozyFolder}
          entries={[cozyFile]}
          onClose={onCloseSpy}
          onConfirm={onConfirmSpy}
        />
      </AppLike>
    )
  }

  it('should be able to move inside another folder', async () => {
    setup()

    expect(screen.getByText('Photos')).toBeInTheDocument()

    const backButton = screen.getByRole('button', {
      name: 'Back'
    })
    fireEvent.click(backButton)
    await screen.findByText('Files')

    const moveButton = screen.queryByRole('button', {
      name: 'Move'
    })
    fireEvent.click(moveButton)
    expect(onConfirmSpy).toHaveBeenCalledWith(rootCozyFolder)
  })

  it('should display the folder creation input', async () => {
    setup()

    const addFolderButton = screen.queryByRole('button', {
      name: 'Add a folder'
    })
    fireEvent.click(addFolderButton)

    const filenameInput = await screen.findByTestId('name-input')
    expect(filenameInput).toBeInTheDocument()
  })

  it('should render with the provided folder', async () => {
    setup()

    expect(screen.getByTestId('folder-picker-body')).toBeInTheDocument()

    const {
      FolderPickerBody
    } = require('@/components/FolderPicker/FolderPickerBody')

    const props = FolderPickerBody.mock.calls[0][0]

    expect(props.folder).toEqual(cozyFolder)
    expect(props.entries).toEqual([cozyFile])
    expect(typeof props.navigateTo).toBe('function')
  })

  it('should allow folder creation when canCreateFolder is true', async () => {
    const mockClient = createMockClient()
    render(
      <AppLike client={mockClient}>
        <FolderPicker
          currentFolder={cozyFolder}
          entries={[cozyFile]}
          onClose={onCloseSpy}
          onConfirm={onConfirmSpy}
          canCreateFolder={true}
        />
      </AppLike>
    )

    expect(screen.getByTestId('folder-picker-body')).toBeInTheDocument()
  })
})

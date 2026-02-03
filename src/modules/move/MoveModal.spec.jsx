import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient, useQuery } from 'cozy-client'
import { move } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'

import { MoveModal } from './MoveModal'
import AppLike from 'test/components/AppLike'

import { ROOT_DIR_ID } from '@/constants/config'
import { CozyFile } from '@/models'

jest.mock('cozy-sharing', () => ({
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn()
}))

jest.mock('cozy-doctypes')
CozyFile.doctype = 'io.cozy.files'
const onCloseSpy = jest.fn()
const refreshSpy = jest.fn()

jest.mock('cozy-client/dist/models/file', () => ({
  move: jest.fn(),
  isFile: jest.fn(),
  moveRelateToSharedDrive: jest.fn()
}))

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))

CozyFile.splitFilename.mockImplementation(({ name }) => ({
  filename: name,
  extension: ''
}))

jest.mock('components/FolderPicker/FolderPicker', () => ({
  FolderPicker: ({ onConfirm, currentFolder, isBusy }) => {
    const handleClick = () => {
      onConfirm(currentFolder)
    }

    return (
      <div>
        <h1>{currentFolder.name}</h1>
        <button onClick={handleClick} disabled={isBusy}>
          Move
        </button>
        <button>Close</button>
      </div>
    )
  }
}))

describe('MoveModal component', () => {
  const defaultEntries = [
    {
      _id: 'bill_201901',
      dir_id: 'bills',
      name: 'bill_201901.pdf',
      path: '/bills/bill_201901.pdf'
    },
    {
      _id: 'bill_201902',
      dir_id: 'bills',
      name: 'bill_201902.pdf',
      path: '/bills/bill_201902.pdf'
    },
    // shared file:
    {
      _id: 'bill_201903',
      dir_id: 'bills',
      name: 'bill_201903.pdf',
      path: '/bills/bill_201903.pdf'
    }
  ]

  const destinationFolder = {
    id: 'destinationFolder',
    _id: 'destinationFolder',
    _type: 'io.cozy.files',
    name: 'Destination Folder',
    path: '/Destination Folder'
  }

  const mockClient = createMockClient({
    queries: {
      'moveOrImport-destinationFolder': {
        doctype: 'io.cozy.files',
        data: []
      },
      'io.cozy.files/destinationFolder': {
        doctype: 'io.cozy.files',
        data: [
          {
            _id: 'destinationFolder',
            dir_id: ROOT_DIR_ID,
            name: 'Destination Folder',
            type: 'directory'
          }
        ]
      },
      'io.cozy.files/path/bills': {
        doctype: 'io.cozy.files',
        data: [
          {
            _id: 'bills',
            dir_id: ROOT_DIR_ID,
            name: 'Bills',
            type: 'directory'
          }
        ]
      }
    }
  })

  const setup = ({
    entries = defaultEntries,
    sharedPaths = ['/sharedFolder'],
    byDocId = {},
    getSharedParentPath = () => null,
    allLoaded = true,
    sharingContext = {},
    currentFolder = destinationFolder
  } = {}) => {
    const props = {
      entries,
      onClose: onCloseSpy,
      classes: { paper: {} }
    }

    // Mock the useQuery hook for shared folder data
    const sharedParentPath = getSharedParentPath(entries[0]?.path || '')
    if (sharedParentPath) {
      const folderName = sharedParentPath.split('/').pop() || 'Bills'
      useQuery.mockReturnValue({
        fetchStatus: 'loaded',
        data: [{ name: folderName }]
      })
    } else {
      useQuery.mockReturnValue({
        fetchStatus: 'loaded',
        data: []
      })
    }

    useSharingContext.mockReturnValue({
      sharedPaths,
      refresh: refreshSpy,
      getSharedParentPath,
      hasSharedParent: path =>
        sharedPaths.filter(sharedPath => path.includes(sharedPath)).length > 0,
      byDocId,
      allLoaded,
      ...sharingContext
    })

    CozyFile.getFullpath.mockImplementation(
      (destinationFolder, name) => `/${destinationFolder}/${name}`
    )

    move.mockImplementation(id => {
      if (id === 'bill_201902') {
        return Promise.resolve({
          deleted: 'other_bill_201902',
          moved: { id }
        })
      } else {
        return Promise.resolve({
          deleted: null,
          moved: { id }
        })
      }
    })

    return render(
      <AppLike client={mockClient}>
        <MoveModal {...props} currentFolder={currentFolder} />
      </AppLike>
    )
  }

  describe('MoveModal', () => {
    it('should wait for shares to load before authorising moves', async () => {
      await waitFor(async () => {
        setup({ allLoaded: false })
      })

      const moveButton = await screen.findByRole('button', {
        name: 'Move'
      })
      expect(moveButton).toBeDisabled()
    })

    it('should move entries to destination', async () => {
      CozyFile.getFullpath.mockImplementation((destinationFolder, name) =>
        Promise.resolve(
          name === 'bill_201903.pdf' ? '/bills/bill_201903.pdf' : '/whatever'
        )
      )

      setup()

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        expect(move).toHaveBeenNthCalledWith(
          1,
          mockClient,
          defaultEntries[0],
          destinationFolder,
          { force: true }
        )

        expect(move).toHaveBeenNthCalledWith(
          2,
          mockClient,
          defaultEntries[1],
          destinationFolder,
          { force: true }
        )
        // don't force a shared file
        expect(move).toHaveBeenNthCalledWith(
          3,
          mockClient,
          defaultEntries[2],
          destinationFolder,
          { force: true }
        )
        expect(onCloseSpy).toHaveBeenCalled()
        expect(refreshSpy).toHaveBeenCalled()
        // TODO: check that trashedFiles are passed to cancel button
      })
    })
  })

  describe('move outside shared folder', () => {
    it('should display an alert when moving files outside a shared folder', async () => {
      setup({
        sharedPaths: ['/bills'],
        getSharedParentPath: path =>
          path.includes('/bills') ? '/bills' : null,
        byDocId: {}
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        expect(
          screen.getByText('Moving outside the bills folder')
        ).toBeInTheDocument()
      })
    })

    it('should move files when user confirms', async () => {
      setup({
        sharedPaths: ['/bills'],
        getSharedParentPath: path =>
          path.includes('/bills') ? '/bills' : null,
        byDocId: {}
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        const confirmButton = screen.getByText('I understand')
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(move).toHaveBeenCalled()
        expect(onCloseSpy).toHaveBeenCalled()
        expect(refreshSpy).toHaveBeenCalled()
      })
    })
  })

  describe('move inside shared folder', () => {
    it('should display an alert when moving files inside a shared folder', async () => {
      setup({
        sharedPaths: ['/Destination Folder'],
        getSharedParentPath: path =>
          path.includes('/Destination Folder') ? '/Destination Folder' : null,
        byDocId: {}
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      const modalTitle = await screen.findByText('Move to a shared folder?')
      expect(modalTitle).toBeInTheDocument()
    })

    it('should move files when user confirms', async () => {
      setup({
        sharedPaths: ['/Destination Folder'],
        getSharedParentPath: path =>
          path.includes('/Destination Folder') ? '/Destination Folder' : null,
        byDocId: {}
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      const confirmButton = await screen.findByText('Ok')
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(move).toHaveBeenCalled()
        expect(onCloseSpy).toHaveBeenCalled()
        expect(refreshSpy).toHaveBeenCalled()
      })
    })
  })

  describe('move shared folder inside another', () => {
    it('should display an alert when move shared folder inside another', async () => {
      CozyFile.getFullpath.mockImplementation((destinationFolder, name) =>
        Promise.resolve(`/${destinationFolder}/${name}`)
      )

      setup({
        sharedPaths: ['/bills', '/Destination Folder'],
        byDocId: {
          bill_201903: {
            permissions: [],
            sharings: ['sharing-id-1']
          }
        },
        getSharedParentPath: path =>
          path.includes('/bills')
            ? '/bills'
            : path.includes('/Destination Folder')
            ? '/Destination Folder'
            : null
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        expect(screen.getByText('Cannot be moved')).toBeInTheDocument()
      })
    })

    it('should move files after revoke all recipients when folder owner confirms', async () => {
      CozyFile.getFullpath.mockImplementation((destinationFolder, name) =>
        Promise.resolve(`/${destinationFolder}/${name}`)
      )
      const revokeAllSpy = jest.fn()
      const revokeSelfSpy = jest.fn()

      setup({
        sharedPaths: ['/bills', '/Destination Folder'],
        byDocId: {
          bill_201903: {
            permissions: [],
            sharings: ['sharing-id-1']
          }
        },
        getSharedParentPath: path =>
          path.includes('/bills')
            ? '/bills'
            : path.includes('/Destination Folder')
            ? '/Destination Folder'
            : null,
        sharingContext: {
          isOwner: () => true,
          revokeAllRecipients: revokeAllSpy,
          revokeSelf: revokeSelfSpy
        }
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        const confirmButton = screen.getByText('Stop sharing')
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(move).toHaveBeenCalled()
        expect(revokeAllSpy).toHaveBeenCalled()
        expect(revokeSelfSpy).not.toHaveBeenCalled()
        expect(onCloseSpy).toHaveBeenCalled()
        expect(refreshSpy).toHaveBeenCalled()
      })
    })

    it('should move files after revoke self when user confirms', async () => {
      CozyFile.getFullpath.mockImplementation((destinationFolder, name) =>
        Promise.resolve(`/${destinationFolder}/${name}`)
      )
      const revokeAllSpy = jest.fn()
      const revokeSelfSpy = jest.fn()

      setup({
        sharedPaths: ['/bills', '/Destination Folder'],
        byDocId: {
          bill_201903: {
            permissions: [],
            sharings: ['sharing-id-1']
          }
        },
        getSharedParentPath: path =>
          path.includes('/bills')
            ? '/bills'
            : path.includes('/Destination Folder')
            ? '/Destination Folder'
            : null,
        sharingContext: {
          isOwner: () => false,
          revokeAllRecipients: revokeAllSpy,
          revokeSelf: revokeSelfSpy
        }
      })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        const confirmButton = screen.getByText('Stop sharing')
        fireEvent.click(confirmButton)
      })

      await waitFor(() => {
        expect(move).toHaveBeenCalled()
        expect(revokeSelfSpy).toHaveBeenCalled()
        expect(revokeAllSpy).not.toHaveBeenCalled()
        expect(onCloseSpy).toHaveBeenCalled()
        expect(refreshSpy).toHaveBeenCalled()
      })
    })
  })
})

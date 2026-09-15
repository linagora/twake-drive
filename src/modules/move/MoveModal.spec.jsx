import {
  render,
  screen,
  fireEvent,
  waitFor,
  within
} from '@testing-library/react'
import React from 'react'

import { createMockClient, useQuery } from 'cozy-client'
import { move } from 'cozy-client/dist/models/file'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'

import { MoveModal } from './MoveModal'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-flags', () => jest.fn())
jest.mock('cozy-ui/transpiled/react/hooks/useBrowserOffline')
jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))

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
  cancelable: promise => Object.assign(promise, { cancel: jest.fn() }),
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
      <div data-testid="folder-picker">
        <h1>{currentFolder.name}</h1>
        <button onClick={handleClick} disabled={isBusy}>
          Move
        </button>
        <button>Close</button>
      </div>
    )
  }
}))

jest.mock('@/modules/move/MoveTo', () => ({
  __esModule: true,
  MoveTo: ({
    onConfirm,
    onClose,
    currentFolder,
    entries,
    isBusy,
    isDestinationLocked
  }) => {
    const { allLoaded } = require('cozy-sharing').useSharingContext()
    const disabledReason = !allLoaded ? 'Move.permissionsLoading' : null
    const isDisabled = Boolean(isBusy || disabledReason)

    return (
      <div data-testid="move-to">
        <h1>{currentFolder.name}</h1>
        <span data-testid="move-entries">
          {entries.map(entry => entry.name).join(',')}
        </span>
        <span data-testid="destination-locked">
          {String(isDestinationLocked)}
        </span>
        <button
          onClick={() => onConfirm(currentFolder)}
          disabled={isDisabled}
          aria-label={disabledReason ?? undefined}
        >
          Move
        </button>
        <button onClick={onClose} disabled={isDisabled}>
          Close
        </button>
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

  beforeEach(() => {
    flag.mockImplementation(name => name === 'drive.move-to-picker.enabled')
    useBrowserOffline.mockReturnValue(false)
  })

  const setup = ({
    entries = defaultEntries,
    sharedPaths = ['/sharedFolder'],
    byDocId = {},
    getSharedParentPath = () => null,
    allLoaded = true,
    sharingContext = {},
    currentFolder = destinationFolder,
    isPublic = false,
    onMovingSuccess
  } = {}) => {
    const props = {
      entries,
      onClose: onCloseSpy,
      onMovingSuccess,
      classes: { paper: {} },
      isPublic
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
    it('reports permission loading before authorising moves', async () => {
      await waitFor(async () => {
        setup({ allLoaded: false })
      })

      const moveButton = await screen.findByRole('button', {
        name: 'Move.permissionsLoading'
      })
      expect(moveButton).toBeDisabled()
    })

    it('should not crash when entries have no path attribute', async () => {
      const entriesWithoutPath = [
        {
          _id: 'no_path_file',
          dir_id: 'bills',
          name: 'no_path_file.pdf'
        }
      ]

      setup({ entries: entriesWithoutPath })

      const moveButton = await screen.findByText('Move')
      fireEvent.click(moveButton)

      await waitFor(() => {
        expect(move).toHaveBeenCalled()
        expect(onCloseSpy).toHaveBeenCalled()
      })
    })

    it('keeps the modal open and retries only failed entries after a partial success', async () => {
      let shouldFail = true
      const onMovingSuccess = jest.fn()
      setup({ entries: defaultEntries.slice(0, 2), onMovingSuccess })
      move.mockImplementation((_client, entry) => {
        if (entry._id === 'bill_201902' && shouldFail) {
          return Promise.reject(new Error('network error'))
        }
        return Promise.resolve({
          deleted: entry._id === 'bill_201901' ? 'trashed-file' : null,
          moved: entry
        })
      })

      fireEvent.click(await screen.findByText('Move'))

      await waitFor(() => {
        expect(screen.getByTestId('move-entries')).toHaveTextContent(
          /^bill_201902.pdf$/
        )
      })
      expect(screen.getByTestId('move-entries')).not.toHaveTextContent(
        'bill_201901.pdf'
      )
      expect(screen.getByTestId('destination-locked')).toHaveTextContent('true')
      expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled()
      expect(
        within(screen.getByTestId('move-to')).getByRole('button', {
          name: 'Close'
        })
      ).toBeEnabled()
      expect(screen.getByText('Moved: 1. Failed: 1.')).toBeInTheDocument()
      expect(onCloseSpy).not.toHaveBeenCalled()
      expect(onMovingSuccess).not.toHaveBeenCalled()

      shouldFail = false
      fireEvent.click(screen.getByRole('button', { name: 'Move' }))

      await waitFor(() => expect(onCloseSpy).toHaveBeenCalledTimes(1))
      expect(move.mock.calls.map(([, entry]) => entry._id)).toEqual([
        'bill_201901',
        'bill_201902',
        'bill_201902'
      ])
      expect(onMovingSuccess).toHaveBeenCalledTimes(1)
      expect(
        await screen.findByText(
          '2 elements have been moved to Destination Folder.'
        )
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('notifies only successful entries when closing after a partial success', async () => {
      setup({ entries: defaultEntries.slice(0, 2) })
      move.mockImplementation((_client, entry) =>
        entry._id === 'bill_201902'
          ? Promise.reject(new Error('network error'))
          : Promise.resolve({ deleted: null, moved: entry })
      )
      fireEvent.click(await screen.findByText('Move'))
      await screen.findByText('Moved: 1. Failed: 1.')
      fireEvent.click(
        within(screen.getByTestId('move-to')).getByRole('button', {
          name: 'Close'
        })
      )

      expect(onCloseSpy).toHaveBeenCalledTimes(1)
      expect(
        await screen.findByText(
          'bill_201901.pdf has been moved to Destination Folder.'
        )
      ).toBeInTheDocument()
      expect(
        screen.queryByText(
          'bill_201902.pdf has been moved to Destination Folder.'
        )
      ).toBe(null)
    })

    it('keeps the modal open and restores controls after every move fails', async () => {
      setup({ entries: defaultEntries.slice(0, 2) })
      move.mockRejectedValue(new Error('network error'))
      fireEvent.click(await screen.findByText('Move'))

      await screen.findByText(
        'Something went wrong while moving these elements, please try again later.'
      )
      expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled()
      expect(
        within(screen.getByTestId('move-to')).getByRole('button', {
          name: 'Close'
        })
      ).toBeEnabled()
      expect(screen.getByTestId('destination-locked')).toHaveTextContent(
        'false'
      )
      expect(onCloseSpy).not.toHaveBeenCalled()
    })

    it('does not start a move while offline', async () => {
      useBrowserOffline.mockReturnValue(true)
      setup({ entries: defaultEntries.slice(0, 1) })

      fireEvent.click(await screen.findByText('Move'))

      expect(move).not.toHaveBeenCalled()
      expect(onCloseSpy).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Move' })).toBeEnabled()
      expect(
        screen.getByText(
          'Something went wrong while moving this element, please try again later.'
        )
      ).toBeInTheDocument()
    })

    it('locks close and confirmation while moves are pending', async () => {
      let resolveMove
      setup({ entries: defaultEntries.slice(0, 1) })
      move.mockReturnValue(
        new Promise(resolve => {
          resolveMove = resolve
        })
      )

      fireEvent.click(await screen.findByText('Move'))

      expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()

      resolveMove({ deleted: null, moved: defaultEntries[0] })
      await waitFor(() => expect(onCloseSpy).toHaveBeenCalledTimes(1))
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

  describe('feature flag drive.move-to-picker.enabled', () => {
    it('renders MoveTo when the flag is enabled for non-public moves', () => {
      flag.mockImplementation(name => name === 'drive.move-to-picker.enabled')
      setup({ currentFolder: destinationFolder })
      expect(screen.getByTestId('move-to')).toBeInTheDocument()
      expect(screen.queryByTestId('folder-picker')).not.toBeInTheDocument()
    })

    it('renders legacy FolderPicker when the flag is disabled', () => {
      flag.mockImplementation(() => false)
      setup({ currentFolder: destinationFolder })
      expect(screen.getByTestId('folder-picker')).toBeInTheDocument()
      expect(screen.queryByTestId('move-to')).not.toBeInTheDocument()
    })

    it('renders legacy FolderPicker when isPublic is true even if flag is enabled', () => {
      flag.mockImplementation(() => true)
      setup({ currentFolder: destinationFolder, isPublic: true })
      expect(screen.getByTestId('folder-picker')).toBeInTheDocument()
      expect(screen.queryByTestId('move-to')).not.toBeInTheDocument()
    })
  })
})

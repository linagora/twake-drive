import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { copy, moveRelateToSharedDrive } from 'cozy-client/dist/models/file'

import { DuplicateModal } from './DuplicateModal'

import { ROOT_DIR_ID } from '@/constants/config'

const mockClient = { resetQuery: jest.fn() }
const mockShowAlert = jest.fn()
const mockRegisterCancelable = jest.fn(promise => promise)

jest.mock('cozy-client/dist/models/file', () => ({
  copy: jest.fn(),
  isFile: jest.fn(file => file?.type !== 'directory'),
  moveRelateToSharedDrive: jest.fn()
}))

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: () => mockClient
}))

jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: () => ({ showAlert: mockShowAlert })
}))

jest.mock('twake-i18n', () => ({ useI18n: () => ({ t: key => key }) }))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}))

jest.mock('@/modules/move/hooks/useCancelable', () => ({
  useCancelable: () => ({ registerCancelable: mockRegisterCancelable })
}))

jest.mock('@/components/FolderPicker/FolderPicker', () => ({
  FolderPicker: ({ onConfirm, currentFolder }) => (
    <button onClick={() => onConfirm(currentFolder)}>Duplicate here</button>
  )
}))

const ALICE = 'https://alice.cozy.example/'
const CAROL = 'https://carol.cozy.example/'

const sharedDriveFile = {
  _id: 'file-in-drive',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'report.pdf',
  driveId: 'drive-1',
  cozyMetadata: { createdOn: ALICE }
}

const personalFile = {
  _id: 'personal-file',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'notes.txt'
}

const personalRoot = {
  _id: ROOT_DIR_ID,
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Files'
}

const sharedDriveSubfolder = {
  _id: 'folder-in-drive',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Reports',
  driveId: 'drive-1',
  cozyMetadata: { createdOn: ALICE }
}

const nextcloudFolder = {
  _id: 'nextcloud-folder',
  _type: 'io.cozy.remote.nextcloud.files',
  type: 'directory',
  name: 'Nextcloud',
  path: '/Nextcloud'
}

const sharedDriveFolder = (driveId, createdOn) => ({
  _id: `folder-in-${driveId}`,
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Folder',
  driveId,
  cozyMetadata: { createdOn }
})

const renderAndConfirm = (entries, destination) => {
  render(
    <DuplicateModal
      entries={entries}
      currentFolder={destination}
      onClose={jest.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate here' }))
}

const duplicate = async (entries, destination) => {
  renderAndConfirm(entries, destination)
  await waitFor(() =>
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  )
}

describe('DuplicateModal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('copies a shared drive file into the personal drive through the shared drive API', async () => {
    await duplicate([sharedDriveFile], personalRoot)

    expect(moveRelateToSharedDrive).toHaveBeenCalledWith(
      mockClient,
      {
        instance: ALICE,
        file_id: 'file-in-drive',
        dir_id: '',
        sharing_id: 'drive-1'
      },
      { instance: '', sharing_id: undefined, dir_id: ROOT_DIR_ID },
      true
    )
    expect(copy).not.toHaveBeenCalled()
  })

  it('copies a personal file into a shared drive through the shared drive API', async () => {
    await duplicate([personalFile], sharedDriveFolder('drive-1', ALICE))

    expect(moveRelateToSharedDrive).toHaveBeenCalledWith(
      mockClient,
      {
        instance: '',
        file_id: 'personal-file',
        dir_id: '',
        sharing_id: undefined
      },
      { instance: ALICE, sharing_id: 'drive-1', dir_id: 'folder-in-drive-1' },
      true
    )
    expect(copy).not.toHaveBeenCalled()
  })

  it('copies a file from a shared drive into another shared drive through the shared drive API', async () => {
    await duplicate([sharedDriveFile], sharedDriveFolder('drive-2', CAROL))

    expect(moveRelateToSharedDrive).toHaveBeenCalledWith(
      mockClient,
      {
        instance: ALICE,
        file_id: 'file-in-drive',
        dir_id: '',
        sharing_id: 'drive-1'
      },
      { instance: CAROL, sharing_id: 'drive-2', dir_id: 'folder-in-drive-2' },
      true
    )
    expect(copy).not.toHaveBeenCalled()
  })

  it('copies inside the same shared drive with the drive copy route', async () => {
    const destination = sharedDriveFolder('drive-1', ALICE)

    await duplicate([sharedDriveFile], destination)

    expect(copy).toHaveBeenCalledWith(
      mockClient,
      sharedDriveFile,
      destination,
      {
        driveId: 'drive-1'
      }
    )
    expect(moveRelateToSharedDrive).not.toHaveBeenCalled()
  })

  it('copies inside the personal drive with the files copy route', async () => {
    await duplicate([personalFile], personalRoot)

    expect(copy).toHaveBeenCalledWith(mockClient, personalFile, personalRoot, {
      driveId: undefined
    })
    expect(moveRelateToSharedDrive).not.toHaveBeenCalled()
  })

  it('sends a folder as dir_id when copying it out of a shared drive', async () => {
    await duplicate([sharedDriveSubfolder], personalRoot)

    expect(moveRelateToSharedDrive).toHaveBeenCalledWith(
      mockClient,
      {
        instance: ALICE,
        file_id: '',
        dir_id: 'folder-in-drive',
        sharing_id: 'drive-1'
      },
      { instance: '', sharing_id: undefined, dir_id: ROOT_DIR_ID },
      true
    )
  })

  it('copies every entry and registers each copy as cancelable', async () => {
    await duplicate([sharedDriveFile, sharedDriveSubfolder], personalRoot)

    expect(moveRelateToSharedDrive).toHaveBeenCalledTimes(2)
    expect(mockRegisterCancelable).toHaveBeenCalledTimes(2)
  })

  it('keeps the Nextcloud copy route for a Nextcloud destination', async () => {
    await duplicate([sharedDriveFile], nextcloudFolder)

    expect(copy).toHaveBeenCalledWith(
      mockClient,
      sharedDriveFile,
      nextcloudFolder,
      { driveId: 'drive-1' }
    )
    expect(moveRelateToSharedDrive).not.toHaveBeenCalled()
  })

  it('keeps the Nextcloud copy route for a Nextcloud entry', async () => {
    const nextcloudFile = {
      _id: 'nextcloud-file',
      _type: 'io.cozy.remote.nextcloud.files',
      type: 'file',
      name: 'remote.txt'
    }

    await duplicate([nextcloudFile], personalRoot)

    expect(copy).toHaveBeenCalledWith(mockClient, nextcloudFile, personalRoot, {
      driveId: undefined
    })
    expect(moveRelateToSharedDrive).not.toHaveBeenCalled()
  })

  it('shows an error when the copy fails', async () => {
    moveRelateToSharedDrive.mockRejectedValueOnce(new Error('404'))

    renderAndConfirm([sharedDriveFile], personalRoot)

    await waitFor(() =>
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'DuplicateModal.error',
          severity: 'error'
        })
      )
    )
  })
})

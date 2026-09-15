import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { MoveSharedDriveFilesView } from './MoveSharedDriveFilesView'

import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { useQueryMultipleSharedDriveFolders } from '@/modules/shareddrives/hooks/useQueryMultipleSharedDriveFolders'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  Navigate: ({ to, replace }) => (
    <div data-testid="navigate">{`to:${to},replace:${replace}`}</div>
  )
}))

jest.mock('@/hooks/useDisplayedFolder', () => jest.fn())
jest.mock(
  '@/modules/shareddrives/hooks/useQueryMultipleSharedDriveFolders',
  () => ({
    useQueryMultipleSharedDriveFolders: jest.fn()
  })
)

jest.mock('@/components/LoaderModal', () => ({
  LoaderModal: () => <div data-testid="loader-modal">Loading</div>
}))

jest.mock('@/modules/move/MoveModal', () => ({
  __esModule: true,
  default: ({
    onClose,
    onMovingSuccess,
    showNextcloudFolder,
    showSharedDriveFolder,
    entries,
    currentFolder,
    driveId
  }) => (
    <div data-testid="move-modal">
      <span data-testid="current-folder">{currentFolder.name}</span>
      <span data-testid="drive-id">{driveId}</span>
      <span data-testid="entries-count">{entries.length}</span>
      <span data-testid="first-entry-path">{entries[0]?.path}</span>
      <span data-testid="show-nextcloud">{String(showNextcloudFolder)}</span>
      <span data-testid="show-shared-drive">
        {String(showSharedDriveFolder)}
      </span>
      <button onClick={onClose}>Close modal</button>
      <button onClick={onMovingSuccess}>Success modal</button>
    </div>
  )
}))

describe('MoveSharedDriveFilesView', () => {
  const displayedFolder = {
    _id: 'shared-folder-1',
    driveId: 'drive-abc',
    name: 'Shared Folder 1',
    path: '/Shared drives/Team/Shared Folder 1'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useDisplayedFolder.mockReturnValue({ displayedFolder })
    mockUseLocation.mockReturnValue({
      state: { fileIds: ['shared-file-1', 'shared-file-2'] }
    })
    useQueryMultipleSharedDriveFolders.mockReturnValue({
      sharedDriveResults: [
        { _id: 'shared-file-1', name: 'File 1.pdf', type: 'file' },
        { _id: 'shared-file-2', name: 'File 2.pdf', type: 'file' }
      ]
    })
  })

  it('redirects to .. when state has no fileIds', () => {
    mockUseLocation.mockReturnValue({ state: null })
    render(<MoveSharedDriveFilesView />)

    expect(screen.getByTestId('navigate')).toHaveTextContent(
      'to:..,replace:true'
    )
  })

  it('shows LoaderModal when results are not loaded yet', () => {
    useQueryMultipleSharedDriveFolders.mockReturnValue({
      sharedDriveResults: null
    })
    render(<MoveSharedDriveFilesView />)

    expect(screen.getByTestId('loader-modal')).toBeInTheDocument()
  })

  it('renders MoveModal with driveId, entries paths and only My Drive experience', () => {
    render(<MoveSharedDriveFilesView />)

    expect(screen.getByTestId('move-modal')).toBeInTheDocument()
    expect(screen.getByTestId('current-folder')).toHaveTextContent(
      'Shared Folder 1'
    )
    expect(screen.getByTestId('drive-id')).toHaveTextContent('drive-abc')
    expect(screen.getByTestId('entries-count')).toHaveTextContent('2')
    expect(screen.getByTestId('first-entry-path')).toHaveTextContent(
      '/Shared drives/Team/Shared Folder 1/File 1.pdf'
    )
    expect(screen.getByTestId('show-nextcloud')).toHaveTextContent('true')
    expect(screen.getByTestId('show-shared-drive')).toHaveTextContent('true')
  })

  it('navigates to .. on onClose even when in viewer (staying in viewer after cancelling)', () => {
    render(<MoveSharedDriveFilesView isOpenInViewer={true} />)

    fireEvent.click(screen.getByText('Close modal'))
    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })

  it('navigates to ../.. on onMovingSuccess when in viewer (exiting viewer after move)', () => {
    render(<MoveSharedDriveFilesView isOpenInViewer={true} />)

    fireEvent.click(screen.getByText('Success modal'))
    expect(mockNavigate).toHaveBeenCalledWith('../..', { replace: true })
  })

  it('navigates to .. on onMovingSuccess when not in viewer', () => {
    render(<MoveSharedDriveFilesView isOpenInViewer={false} />)

    fireEvent.click(screen.getByText('Success modal'))
    expect(mockNavigate).toHaveBeenCalledWith('..', { replace: true })
  })
})

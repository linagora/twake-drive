import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { MoveSharedDriveFilesView } from './MoveSharedDriveFilesView'

import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { useQueryMultipleSharedDriveFolders } from '@/modules/shareddrives/hooks/useQueryMultipleSharedDriveFolders'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()
const mockUseParams = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
  useParams: () => mockUseParams(),
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
  default: ({ onClose, onMovingSuccess }) => (
    <div>
      <button onClick={onClose}>Close modal</button>
      <button onClick={onMovingSuccess}>Success modal</button>
    </div>
  )
}))

describe('MoveSharedDriveFilesView', () => {
  const displayedFolder = {
    _id: 'shared-folder-1',
    name: 'Shared Folder 1',
    path: '/Team/Shared Folder 1'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useDisplayedFolder.mockReturnValue({ displayedFolder })
    mockUseLocation.mockReturnValue({
      state: { fileIds: ['shared-file-1', 'shared-file-2'] }
    })
    mockUseParams.mockReturnValue({ driveId: 'drive-abc' })
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

  it('queries entries with the route driveId', () => {
    render(<MoveSharedDriveFilesView />)

    expect(useQueryMultipleSharedDriveFolders).toHaveBeenCalledWith({
      driveId: 'drive-abc',
      folderIds: ['shared-file-1', 'shared-file-2']
    })
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
